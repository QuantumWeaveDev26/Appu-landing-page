const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendDir = path.resolve(__dirname, '../frontend');

describe('Public Legal & Policy Pages (Razorpay Compliance)', () => {
  const policyFiles = [
    'privacy-policy.html',
    'terms-and-conditions.html',
    'cancellation-refund-policy.html',
    'shipping-delivery-policy.html',
    'contact-us.html',
    'pricing.html'
  ];

  test('all required public policy and legal HTML files exist in frontend/', () => {
    for (const filename of policyFiles) {
      const filePath = path.join(frontendDir, filename);
      assert.ok(fs.existsSync(filePath), `Required policy file ${filename} must exist`);
      const stat = fs.statSync(filePath);
      assert.ok(stat.size > 500, `${filename} must contain substantial content`);
    }
  });

  test('each policy page has exactly one h1 and semantic structure', () => {
    for (const filename of policyFiles) {
      const content = fs.readFileSync(path.join(frontendDir, filename), 'utf8');
      const h1Matches = content.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
      assert.equal(h1Matches.length, 1, `${filename} must have exactly one <h1> element`);

      // Check header and footer semantics
      assert.ok(content.includes('<header'), `${filename} must have a semantic <header>`);
      assert.ok(content.includes('<main'), `${filename} must have a semantic <main>`);
      assert.ok(content.includes('<footer'), `${filename} must have a semantic <footer>`);
    }
  });

  test('each policy page cross-links to all other legal policies and return to Appu', () => {
    for (const filename of policyFiles) {
      const content = fs.readFileSync(path.join(frontendDir, filename), 'utf8');
      assert.ok(content.includes('privacy-policy.html'), `${filename} must link to privacy-policy.html`);
      assert.ok(content.includes('terms-and-conditions.html'), `${filename} must link to terms-and-conditions.html`);
      assert.ok(content.includes('cancellation-refund-policy.html'), `${filename} must link to cancellation-refund-policy.html`);
      assert.ok(content.includes('shipping-delivery-policy.html'), `${filename} must link to shipping-delivery-policy.html`);
      assert.ok(content.includes('pricing.html'), `${filename} must link to pricing.html`);
      assert.ok(content.includes('contact-us.html'), `${filename} must link to contact-us.html`);
      assert.ok(content.includes('index.html'), `${filename} must link back to index.html`);
    }
  });

  test('landing page (index.html) contains visible public footer links outside app-shell and response-dock', () => {
    const indexContent = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');

    // All links present
    assert.ok(indexContent.includes('privacy-policy.html'), 'index.html must link to privacy-policy.html');
    assert.ok(indexContent.includes('terms-and-conditions.html'), 'index.html must link to terms-and-conditions.html');
    assert.ok(indexContent.includes('cancellation-refund-policy.html'), 'index.html must link to cancellation-refund-policy.html');
    assert.ok(indexContent.includes('shipping-delivery-policy.html'), 'index.html must link to shipping-delivery-policy.html');
    assert.ok(indexContent.includes('pricing.html'), 'index.html must link to pricing.html');
    assert.ok(indexContent.includes('contact-us.html'), 'index.html must link to contact-us.html');

    // Footer is strictly outside the response-dock and response-card
    const responseCardMatch = indexContent.match(/<div class="response-card">([\s\S]*?)<\/div>/i);
    assert.ok(responseCardMatch, 'response-card must exist');
    assert.ok(!responseCardMatch[1].includes('landing-footer-strip'), 'landing-footer-strip must NOT be inside response-card');

    const responseDockMatch = indexContent.match(/<section class="response-dock"[\s\S]*?<\/section>/i);
    assert.ok(responseDockMatch, 'response-dock must exist');
    assert.ok(!responseDockMatch[0].includes('landing-footer-strip'), 'landing-footer-strip must NOT be inside response-dock');

    // Footer is strictly outside app-shell
    const appShellMatch = indexContent.match(/<div id="app-shell"[\s\S]*?<\/div>\s*<footer class="landing-footer-strip"/i);
    assert.ok(appShellMatch, 'landing-footer-strip must be positioned outside and after #app-shell');

    // Ensure style.css does NOT use position:absolute or position:fixed for landing-footer-strip
    const cssContent = fs.readFileSync(path.join(frontendDir, 'style.css'), 'utf8');
    const footerCssBlock = cssContent.match(/\.landing-footer-strip\s*\{([^}]*)\}/i);
    assert.ok(footerCssBlock, 'landing-footer-strip rule must exist in CSS');
    assert.ok(!footerCssBlock[1].includes('position: absolute'), 'Footer must not use position: absolute');
    assert.ok(!footerCssBlock[1].includes('position: fixed'), 'Footer must not use position: fixed');

    // Ensure .app-shell does not force 100dvh pushing footer below the fold
    const appShellCssBlock = cssContent.match(/\.app-shell\s*\{([^}]*)\}/i);
    assert.ok(appShellCssBlock, 'app-shell rule must exist in CSS');
    assert.ok(!appShellCssBlock[1].includes('min-height: 100dvh'), 'app-shell must not force min-height: 100dvh');
    assert.ok(!appShellCssBlock[1].includes('height: 100dvh'), 'app-shell must not force height: 100dvh');
  });

  test('pricing.html reflects the canonical 5-tier APPU catalogue without price mutations', () => {
    const pricingContent = fs.readFileSync(path.join(frontendDir, 'pricing.html'), 'utf8');
    assert.ok(pricingContent.includes('APPU Free'), 'Must include APPU Free');
    assert.ok(pricingContent.includes('APPU Evolve'), 'Must include APPU Evolve');
    assert.ok(pricingContent.includes('APPU Evolve+'), 'Must include APPU Evolve+');
    assert.ok(pricingContent.includes('APPU Genesis'), 'Must include APPU Genesis');
    assert.ok(pricingContent.includes('APPU Signature'), 'Must include APPU Signature');

    // Check pricing figures
    assert.ok(pricingContent.includes('₹0'), 'Free must be ₹0');
    assert.ok(pricingContent.includes('₹499'), 'Evolve monthly must be ₹499');
    assert.ok(pricingContent.includes('₹4,999'), 'Evolve annual must be ₹4,999');
    assert.ok(pricingContent.includes('₹999'), 'Evolve+ monthly must be ₹999');
    assert.ok(pricingContent.includes('₹9,999'), 'Evolve+ annual must be ₹9,999');
  });

  test('shipping and cancellation policies state 100% digital SaaS delivery and Razorpay gateway', () => {
    const shippingContent = fs.readFileSync(path.join(frontendDir, 'shipping-delivery-policy.html'), 'utf8');
    assert.ok(shippingContent.includes('Digital'), 'Shipping policy must state digital delivery');
    assert.ok(shippingContent.includes('Razorpay'), 'Shipping policy must reference Razorpay');
    assert.ok(shippingContent.includes('appuai.online'), 'Shipping policy must reference appuai.online');

    const refundContent = fs.readFileSync(path.join(frontendDir, 'cancellation-refund-policy.html'), 'utf8');
    assert.ok(refundContent.includes('Razorpay'), 'Refund policy must reference Razorpay');
    assert.ok(refundContent.includes('Parent Zone'), 'Refund policy must explain cancellation via Parent Zone');
  });

  test('privacy policy addresses minor learner data with parent/guardian supervision', () => {
    const privacyContent = fs.readFileSync(path.join(frontendDir, 'privacy-policy.html'), 'utf8');
    assert.ok(privacyContent.includes('Minor Learner'), 'Privacy policy must address minor learners');
    assert.ok(privacyContent.includes('parent') || privacyContent.includes('guardian'), 'Privacy policy must address parents/guardians');
    assert.ok(privacyContent.includes('Razorpay'), 'Privacy policy must disclose payment processing by Razorpay');
    assert.ok(privacyContent.includes('Supabase'), 'Privacy policy must disclose authentication by Supabase');
  });

  test('clean URL rewrite configuration exists in .htaccess', () => {
    const htaccessPath = path.join(frontendDir, '.htaccess');
    assert.ok(fs.existsSync(htaccessPath), '.htaccess must exist');
    const content = fs.readFileSync(htaccessPath, 'utf8');
    assert.ok(content.includes('RewriteEngine On'), '.htaccess must enable RewriteEngine');
    assert.ok(content.includes('RewriteRule'), '.htaccess must define RewriteRules');
  });
});
