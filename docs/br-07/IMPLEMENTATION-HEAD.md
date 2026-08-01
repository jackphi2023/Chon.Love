# BR-07 Implementation Head

The BR-07 implementation was validated before hosted migration application at:

```text
433398acf1a90606eb0382296cd0ac05fc1d7907
```

Workflow evidence:

- Application CI `#779` — run `30656843957` — PASS
- Database CI `#360` — run `30656844090` — PASS
- Browser E2E `#81` — run `30656844403` — PASS

The implementation head includes:

- private VietQR bank-transaction inbox;
- immutable reconciliation event ledger;
- deterministic exact-token matching;
- finance-admin role checks and independent request idempotency;
- disabled-by-default import, manual settlement, automatic settlement, and web-order flags;
- revocation of direct client VietQR ordering and direct service-role heart credit;
- JWT-protected Edge Function source;
- shared TypeScript/Zod reconciliation contract;
- responsive Admin reconciliation page;
- 34-assertion pgTAP lifecycle ending in `ROLLBACK`;
- exact generated public database types.

The hosted migration version was subsequently reconciled to:

```text
20260731185855_br_07_vietqr_reconciliation_mvp
```

Renaming the repository migration to the hosted ledger version did not change its blob content. Final documentation-head workflows are recorded in `STATUS.md` and the Draft PR after completion.
