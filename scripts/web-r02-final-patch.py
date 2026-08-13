from pathlib import Path

qa_path = Path('tests/br-06/web-r02-final-ui-qa.spec.mjs')
qa = qa_path.read_text()

anchor = "const freeActor = { email: 'br06.outsider@example.test' };\n"
fixture = """
const vietQrVisualFixture = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="white"/>
  <g fill="#081726">
    <path d="M20 20h90v90H20zM35 35v60h60V35zM50 50h30v30H50z" fill-rule="evenodd"/>
    <path d="M210 20h90v90h-90zM225 35v60h60V35zM240 50h30v30h-30z" fill-rule="evenodd"/>
    <path d="M20 210h90v90H20zM35 225v60h60v-60zM50 240h30v30H50z" fill-rule="evenodd"/>
    <path d="M135 20h20v20h-20zM165 20h20v50h-20zM135 55h20v35h-20zM135 105h50v20h-50zM200 130h20v40h-20zM230 130h20v20h-20zM270 130h30v20h-30zM125 145h50v20h-50zM145 175h20v35h-20zM180 180h20v20h-20zM215 185h35v20h-35zM270 175h30v30h-30zM120 220h25v20h-25zM160 225h45v20h-45zM215 220h20v50h-20zM250 225h50v20h-50zM125 260h65v20h-65zM250 260h20v40h-20zM280 270h20v30h-20z"/>
  </g>
  <text x="160" y="312" text-anchor="middle" font-family="Arial" font-size="11" fill="#545454">VietQR UI fixture</text>
</svg>`;
"""
if 'const vietQrVisualFixture' not in qa:
    if anchor not in qa:
        raise SystemExit('R02 actor anchor not found')
    qa = qa.replace(anchor, anchor + fixture, 1)

route_anchor = """    const page = await premiumContext.newPage();
    const freePage = await freeContext.newPage();

    try {
      await Promise.all([login(page, premiumActor), login(freePage, freeActor)]);"""
route_replacement = """    const page = await premiumContext.newPage();
    const freePage = await freeContext.newPage();

    try {
      await freePage.route('https://img.vietqr.io/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: vietQrVisualFixture });
      });
      await Promise.all([login(page, premiumActor), login(freePage, freeActor)]);"""
if "freePage.route('https://img.vietqr.io/**'" not in qa:
    if route_anchor not in qa:
        raise SystemExit('R02 context anchor not found')
    qa = qa.replace(route_anchor, route_replacement, 1)

wait_anchor = """      const qrImage = freePage.getByLabel('Mã VietQR thanh toán gói thành viên');
      await expect(qrImage).toBeVisible({ timeout: 20_000 });"""
wait_replacement = """      const qrImage = freePage.getByLabel('Mã VietQR thanh toán gói thành viên');
      await expect(qrImage).toBeVisible({ timeout: 20_000 });
      await freePage.waitForTimeout(250);"""
if 'await freePage.waitForTimeout(250);' not in qa:
    if wait_anchor not in qa:
        raise SystemExit('R02 QR wait anchor not found')
    qa = qa.replace(wait_anchor, wait_replacement, 1)

qa_path.write_text(qa)
