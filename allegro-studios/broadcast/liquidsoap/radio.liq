# ALLEGRO VIBEZ continuous playlist stream
# Approved audio files are mounted read-only at /media.
settings.harbor.bind_addrs := ["0.0.0.0"]

radio = playlist("/media")
radio = mksafe(radio)

output.harbor(
  mount="/allegro-vibez.mp3",
  port=8000,
  %mp3(bitrate=128),
  radio
)
