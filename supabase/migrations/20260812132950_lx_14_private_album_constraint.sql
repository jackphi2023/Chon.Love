-- LX-14 Private Photo Album
-- Public and private albums are non-monetized; only fan albums may carry a
-- positive fan threshold.

alter table public.albums
  drop constraint if exists albums_public_threshold_zero;

alter table public.albums
  add constraint albums_public_private_threshold_zero check (
    (album_type in ('public','private') and fan_threshold_units = 0)
    or album_type = 'fan'
  );
