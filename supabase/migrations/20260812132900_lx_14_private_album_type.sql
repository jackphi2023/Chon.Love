-- LX-14 Private Photo Album
-- Keep the enum extension in its own migration so PostgreSQL commits the new
-- value before later migrations use it in table writes and function bodies.

alter type public.album_type add value if not exists 'private';
