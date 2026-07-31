# Disabled beta password-reset endpoint

This function is intentionally a permanent HTTP 410 tombstone.

It must not contain service-role access, Auth Admin calls, user lists, passwords, tokens, password verification or any data mutation. BR-01 CI enforces this boundary.
