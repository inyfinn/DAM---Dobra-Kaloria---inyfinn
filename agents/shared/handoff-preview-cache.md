# Handoff: preview cache / Redis / file-availability

Watchdog: read **latest markers** here (and process.md). Do **not** interrupt while
`probe_wait` / `recall_pending` / `generating_thumb` is younger than 5 minutes.

## Markers (append-only during K2/K3)

<!-- worker appends ISO lines below -->

- `2026-07-21T23:09:36+02:00` `probe_wait` rketing\- POLSKA\- BRANDING i MARKA -\KUBARA\01 - LOGO\11x\KUBARA LOGO -  10.png
- `2026-07-21T23:09:36+02:00` `probe_done` readable
- `2026-07-21T23:09:37+02:00` `generating_thumb` 50bda4a14d434d42
- `2026-07-21T23:09:44+02:00` `generating_thumb` d297a6ed76a392b2
- `2026-07-21T23:09:44+02:00` `generating_thumb` fa6deb69e7bc016a
- `2026-07-21T23:09:44+02:00` `generating_thumb` 56902455055b9a90
- `2026-07-21T23:09:44+02:00` `generating_thumb` 2ce3691d09fa8ec3
- `2026-07-21T23:09:44+02:00` `generating_thumb` e1da21c230afa2c4
- `2026-07-21T23:09:44+02:00` `generating_thumb` badf45f3577e39bf
- `2026-07-21T23:09:44+02:00` `generating_thumb` 4af499caaf71af3c
- `2026-07-21T23:09:44+02:00` `generating_thumb` b5dc9b06f1f9b19f
- `2026-07-21T23:09:44+02:00` `generating_thumb` 1d70df6cf9765c86
- `2026-07-21T23:09:44+02:00` `generating_thumb` 9f61d6c081e7eb9f
- `2026-07-21T23:09:44+02:00` `generating_thumb` ba53d0260cfac0bf
- `2026-07-21T23:09:44+02:00` `generating_thumb` 7cdf00f056552508
- `2026-07-21T23:09:44+02:00` `generating_thumb` dc65b014613dc54b
- `2026-07-21T23:09:44+02:00` `generating_thumb` 0f93718c2e95191c
- `2026-07-21T23:09:44+02:00` `generating_thumb` c75f03ce129dc6e0
- `2026-07-21T23:09:44+02:00` `generating_thumb` 057c312d6a51a0e1
- `2026-07-21T23:09:44+02:00` `generating_thumb` 819a863873fd94a5
- `2026-07-21T23:09:44+02:00` `generating_thumb` 6994b6c5bc764843
- `2026-07-21T23:09:44+02:00` `generating_thumb` 8477617b36549441
- `2026-07-21T23:09:44+02:00` `generating_thumb` be5c9b1844072c3d
- `2026-07-21T23:09:44+02:00` `generating_thumb` 232d40a756843b67
- `2026-07-21T23:09:44+02:00` `generating_thumb` 037d635b70215303
- `2026-07-21T23:09:44+02:00` `generating_thumb` 02d94cf978078cb7
- `2026-07-21T23:09:46+02:00` `generating_thumb` b39c885a71ab5e39
- `2026-07-21T23:09:46+02:00` `generating_thumb` 7169a2377f9a6a00
- `2026-07-21T23:09:47+02:00` `generating_thumb` 6d78c8b75e054f55
- `2026-07-21T23:09:47+02:00` `generating_thumb` f19b6943e39ecdad
- `2026-07-21T23:10:34+02:00` `probe_wait` rketing\- POLSKA\- BRANDING i MARKA -\KUBARA\01 - LOGO\11x\KUBARA LOGO -  10.png
- `2026-07-21T23:10:34+02:00` `probe_done` readable
- `2026-07-21T23:10:34+02:00` `generating_thumb` f20e290da00bc3bf
- `2026-07-21T23:10:34+02:00` `generating_thumb` c1d5883d7bbeb0b4
- `2026-07-21T23:10:34+02:00` `generating_thumb` f37b931f4c808d3a
- `2026-07-21T23:10:34+02:00` `generating_thumb` 092ae656111953af
- `2026-07-21T23:10:34+02:00` `generating_thumb` 2b5df4b13890f957
- `2026-07-21T23:10:34+02:00` `generating_thumb` f8ac247f828daa9d
- `2026-07-21T23:10:35+02:00` `generating_thumb` 7ce5fd86f7ccc042
- `2026-07-21T23:10:35+02:00` `generating_thumb` 5697a9ae2a770921
- `2026-07-21T23:10:35+02:00` `generating_thumb` 7bf9e7e1a1907947
- `2026-07-21T23:10:35+02:00` `generating_thumb` 4b6a2a88f92ccde0
- `2026-07-21T23:10:36+02:00` `generating_thumb` b18afb39c8388d30
- `2026-07-21T23:10:36+02:00` `generating_thumb` 1b3ffced7cf1aff4
- `2026-07-21T23:10:36+02:00` `generating_thumb` d5165a5bcf3bc301
- `2026-07-21T23:10:36+02:00` `generating_thumb` dcd1b1aca797124e
- `2026-07-21T23:10:36+02:00` `generating_thumb` dcd1b1aca797124e
- `2026-07-21T23:10:36+02:00` `generating_thumb` b18afb39c8388d30
- `2026-07-21T23:11:24+02:00` `probe_wait` NCZYCH PRODUKTÓW\01 - SŁODKIE\848x1200 MINIBATONIKI\almonds_sepCMYK_Sed_mod4.png
- `2026-07-21T23:11:24+02:00` `probe_done` readable
