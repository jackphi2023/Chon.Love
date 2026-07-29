# MyFan environment decision

**Effective 2026-07-29:** MyFan uses only Supabase project `asnydvqsduonyidjyyzq` at `https://asnydvqsduonyidjyyzq.supabase.co` in `ap-southeast-1`.

Expo Web, Android, iOS, Admin Web and Public Web consume the same Auth users, public API, Realtime, Storage, RPCs and generated TypeScript contract. `development`, `staging` and `production` are Git/build labels, not database-isolation boundaries.

The experimental refs `qxsqrtnelbqquqgbamjo` and `fciyrjtqnifapafqythy` are retired from MyFan configuration. Only project URL and publishable key may enter clients; service-role and database credentials remain server-side.
