# Disabled beta seed endpoint

This function is intentionally a permanent HTTP 410 tombstone.

It must not contain service-role access, Auth Admin calls, user manifests, passwords, tokens, asset transport or any data mutation. BR-01 CI enforces this boundary.
