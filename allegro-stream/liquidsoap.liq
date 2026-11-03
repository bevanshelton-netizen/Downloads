# ALLEGRO VIBEZ automation layer.
# Licensed media is mounted read-only at /media.
# The source password is supplied through the container environment.

set("log.stdout", true)
set("log.file", false)

media = playlist(mode="randomize", reload_mode="watch", "/media")
backup = blank()

radio = fallback(track_sensitive=false, [media, backup])

output.icecast(
  %mp3(bitrate=192, samplerate=44100, stereo=true),
  host="icecast",
  port=8000,
  password=getenv("ICECAST_SOURCE_PASSWORD"),
  mount="/live.mp3",
  name="ALLEGRO VIBEZ",
  genre="African / Global / Culture",
  description="ALLEGRO VIBEZ — music, culture, creators and African sound",
  radio
)
