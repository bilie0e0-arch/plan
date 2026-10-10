'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, VideoOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/** STUN is free and public; a TURN relay (only needed on strict networks) can be configured via env. */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const url = process.env.NEXT_PUBLIC_TURN_URL
  if (url) servers.push({ urls: url.split(','), username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL })
  return servers
}

const CONNECT_TIMEOUT_MS = 12_000
type LinkState = 'connecting' | 'connected' | 'failed'

/**
 * Built-in call: direct browser-to-browser (WebRTC), one connection per person (a mesh — fine for up to 5 people).
 * Signalling travels as rows in `call_signals` addressed to one person (polled), so no extra server is needed and
 * the media never touches Supabase or Vercel. Mics stay muted while focusing. If a link can't connect in ~12 s,
 * the saved call link is offered instead.
 */
export function PairCall({ coSessionId, userId, peers, video, focusing, compact = false, epoch, callLink }: {
  coSessionId: string; userId: string; peers: { id: string; name: string }[]; video: boolean; focusing: boolean
  /** While focusing: a small strip beside (laptop) or above (phone) the clock, so everything fits one screen. */
  compact?: boolean
  /** Changes whenever the room switches its call type; signals from an earlier call are ignored. */
  epoch: string
  callLink: string | null
}) {
  const localRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null | undefined>(undefined) // undefined = asking, null = no mic/camera
  const [states, setStates] = useState<Record<string, LinkState>>({})
  const [micOn, setMicOn] = useState(false)
  const [manualMic, setManualMic] = useState<boolean | null>(null)

  useEffect(() => {
    let closed = false
    let got: MediaStream | null = null
    void navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video })
      .then((s) => {
        if (closed) return s.getTracks().forEach((t) => t.stop())
        got = s
        s.getAudioTracks().forEach((t) => { t.enabled = false })
        setStream(s)
      })
      .catch(() => { if (!closed) setStream(null) }) // no mic/camera: still receive the others
    return () => { closed = true; got?.getTracks().forEach((t) => t.stop()) }
  }, [video])

  useEffect(() => { if (localRef.current && stream) localRef.current.srcObject = stream }, [stream])

  // Muted while focusing, on during breaks — unless you flip it yourself.
  const wantMic = manualMic ?? !focusing
  useEffect(() => {
    stream?.getAudioTracks().forEach((t) => { t.enabled = wantMic })
    // Mirror the track state for the button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicOn(wantMic)
  }, [wantMic, stream])
  useEffect(() => {
    // A new phase resets the manual override.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManualMic(null)
  }, [focusing])

  const list = peers.map((p) => states[p.id] ?? 'connecting')
  const connected = list.filter((s) => s === 'connected').length
  const label = !peers.length ? 'Waiting for others…'
    : connected === peers.length ? 'Connected'
    : list.every((s) => s === 'failed') ? 'Couldn’t connect'
    : connected ? `Connected to ${connected} of ${peers.length}` : 'Connecting…'
  const anyFailed = list.includes('failed')
  const cols = compact ? 'grid-cols-4 md:grid-cols-1' : peers.length + 1 <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'

  return (
    <section aria-label="Call" className={`space-y-2 ${compact && video ? 'md:fixed md:right-5 md:top-14 md:z-20 md:w-48' : ''}`}>
      <div className={`grid gap-2 ${video ? cols : 'grid-cols-1'} ${compact && video ? 'mx-auto max-w-sm md:max-w-none' : 'mx-auto max-w-lg'}`}>
        {video && (
          <div className="relative">
            <video ref={localRef} data-testid="local-video" autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-black/40 object-cover" />
            <span className="absolute bottom-1.5 left-2 text-xs text-white/70">You</span>
          </div>
        )}
        {stream !== undefined && peers.map((p) => (
          <PeerLink key={p.id} coSessionId={coSessionId} userId={userId} peer={p} stream={stream} video={video} epoch={epoch}
            onState={(s) => setStates((x) => (x[p.id] === s ? x : { ...x, [p.id]: s }))} state={states[p.id] ?? 'connecting'} />
        ))}
      </div>
      <div className={`flex flex-wrap items-center justify-center gap-3 text-sm text-white/60 ${compact ? 'gap-2 text-xs' : ''}`}>
        <span data-testid="call-state">{label}</span>
        <button onClick={() => setManualMic(!micOn)} aria-pressed={micOn} className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 hover:bg-white/5">
          {micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}{micOn ? 'Mic on' : 'Muted'}
        </button>
        {anyFailed && (callLink
          ? <a href={callLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/15"><Phone className="size-3.5" />Use your call link</a>
          : !compact && <span className="text-xs">Add a call link on the Friends page as a backup.</span>)}
      </div>
    </section>
  )
}

/** One person-to-person link. The person with the smaller id makes the offer, so each pair negotiates exactly once. */
function PeerLink({ coSessionId, userId, peer, stream, video, epoch, state, onState }: {
  coSessionId: string; userId: string; peer: { id: string; name: string }; stream: MediaStream | null; video: boolean; epoch: string
  state: LinkState; onState: (s: LinkState) => void
}) {
  const remoteRef = useRef<HTMLVideoElement>(null)
  const report = useRef(onState)
  useEffect(() => { report.current = onState })

  useEffect(() => {
    let closed = false
    let lastId = 0
    const sb = createClient()
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    const pendingIce: RTCIceCandidateInit[] = []
    const initiator = userId < peer.id
    // Supabase queries only run when awaited — so `send` awaits (a bare `void builder` would never send).
    const send = async (kind: string, payload: unknown) => {
      await sb.from('call_signals').insert({ co_session_id: coSessionId, to_user: peer.id, kind, payload: { ...(payload as object), epoch } as never })
    }
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream))

    pc.onicecandidate = (e) => { if (e.candidate) void send('ice', e.candidate.toJSON()) }
    pc.ontrack = (e) => { if (remoteRef.current && e.streams[0]) remoteRef.current.srcObject = e.streams[0] }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') report.current('connected')
      else if (pc.connectionState === 'failed') report.current('failed')
    }
    const timeout = setTimeout(() => { if (pc.connectionState !== 'connected') report.current('failed') }, CONNECT_TIMEOUT_MS)

    async function poll() {
      if (closed) return
      const { data } = await sb.from('call_signals').select('id, kind, payload').eq('co_session_id', coSessionId).eq('from_user', peer.id)
        .or(`to_user.eq.${userId},to_user.is.null`).gt('id', lastId).order('id')
      for (const s of data ?? []) {
        lastId = Math.max(lastId, s.id)
        if ((s.payload as { epoch?: string } | null)?.epoch !== epoch) continue // from an earlier call in this room
        try {
          if (s.kind === 'offer' && !initiator) {
            await pc.setRemoteDescription(s.payload as unknown as RTCSessionDescriptionInit)
            for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await send('answer', answer)
          } else if (s.kind === 'answer' && initiator && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(s.payload as unknown as RTCSessionDescriptionInit)
            for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c)
          } else if (s.kind === 'ice') {
            if (pc.remoteDescription) await pc.addIceCandidate(s.payload as unknown as RTCIceCandidateInit)
            else pendingIce.push(s.payload as unknown as RTCIceCandidateInit)
          } else if (s.kind === 'bye') {
            report.current('failed')
          }
        } catch { /* a stale or duplicate signal */ }
      }
    }
    const timer = setInterval(() => void poll(), 1000)
    if (initiator) {
      void (async () => {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video })
        await pc.setLocalDescription(offer)
        await send('offer', offer)
      })()
    }

    return () => {
      closed = true
      clearInterval(timer)
      clearTimeout(timeout)
      void send('bye', {})
      pc.close()
    }
  }, [coSessionId, userId, peer.id, stream, video, epoch])

  return (
    <div className="relative">
      <video ref={remoteRef} data-testid="remote-video" autoPlay playsInline className={`w-full rounded-xl bg-black/40 object-cover ${video ? 'aspect-video' : 'h-0'}`} />
      {video && (
        <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-xs text-white/70">
          {state !== 'connected' && <VideoOff className="size-3.5" />}{peer.name}
        </span>
      )}
    </div>
  )
}
