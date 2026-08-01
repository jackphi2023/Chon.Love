# Implementation notes

The seven historical bootstrap migration files are reconciliation entries, not recovered operational seed logic. Their remote final state had already removed all helper functions/tables and `pg_net`; restoring the temporary privileged implementation would be less secure and would not change the final product schema.

The 16 beta accounts remain in the current remote project as operational fixtures. A clean schema reset intentionally does not create Auth users or passwords.
