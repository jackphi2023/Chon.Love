create index if not exists user_roles_granted_by_idx on private.user_roles(granted_by) where granted_by is not null;
create index if not exists app_config_updated_by_idx on private.app_config(updated_by) where updated_by is not null;
