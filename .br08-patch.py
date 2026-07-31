from pathlib import Path

path = Path('apps/admin/app/kyc-withdrawal-operations/kyc-withdrawal-operations-client.tsx')
text = path.read_text()
old = "const access = await getKycDocumentAccess(client, { kycDocumentId: payload.documentIds[0] });"
new = "const access = await getKycDocumentAccess(client, { kycDocumentId: payload.documentIds[0]! });"
if old not in text:
    raise SystemExit('BR-08 TypeScript target not found')
path.write_text(text.replace(old, new, 1))
