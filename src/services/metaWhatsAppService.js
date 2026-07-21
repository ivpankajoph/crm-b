const graphBase = (version) => `https://graph.facebook.com/${version}`;

const graphRequest = async (path, token, version, params = {}) => {
  const query = new URLSearchParams(params);
  const response = await fetch(`${graphBase(version)}/${path}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || `Meta request failed (${response.status})`);
    error.statusCode = response.status === 401 ? 401 : 400;
    error.metaCode = body.error?.code;
    throw error;
  }
  return body;
};

const getAllPages = async (path, token, version, params) => {
  const items = [];
  let result = await graphRequest(path, token, version, { limit: '100', ...params });
  items.push(...(result.data || []));
  let next = result.paging?.next;
  while (next && items.length < 1000) {
    const response = await fetch(next, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.message || 'Meta pagination request failed');
    items.push(...(result.data || []));
    next = result.paging?.next;
  }
  return items;
};

export const syncWhatsAppAssets = async (token, version = 'v23.0', hints = {}) => {
  const profile = await graphRequest('me', token, version, { fields: 'id,name' });
  const businesses = await getAllPages('me/businesses', token, version, { fields: 'id,name' });
  const accountMap = new Map();

  // Token debugger exposes asset target IDs for tokens created with granular access.
  // It accepts the token itself as the app access token for system-user tokens.
  try {
    const debug = await graphRequest('debug_token', token, version, { input_token: token });
    const targetIds = (debug.data?.granular_scopes || [])
      .filter((scope) => scope.scope === 'whatsapp_business_management')
      .flatMap((scope) => scope.target_ids || []);
    hints.wabaIds = [...new Set([...(hints.wabaIds || []), ...targetIds])];
  } catch { /* Explicit IDs and business edges remain available. */ }

  const hintedBusinesses = (hints.businessIds || []).map((id) => ({ id, name: `Business ${id}` }));
  const businessMap = new Map([...businesses, ...hintedBusinesses].map((business) => [business.id, business]));

  for (const business of businessMap.values()) {
    for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
      let wabas = [];
      try { wabas = await getAllPages(`${business.id}/${edge}`, token, version, { fields: 'id,name,currency,timezone_id,message_template_namespace' }); }
      catch (error) { if (![100, 200].includes(error.metaCode)) throw error; }
      for (const waba of wabas) accountMap.set(waba.id, { ...waba, businessId: business.id, businessName: business.name });
    }
  }

  for (const wabaId of hints.wabaIds || []) {
    try {
      const waba = await graphRequest(wabaId, token, version, { fields: 'id,name,currency,timezone_id,message_template_namespace' });
      accountMap.set(waba.id, waba);
    } catch (error) {
      error.message = `Cannot access WABA ${wabaId}: ${error.message}`;
      throw error;
    }
  }

  // Some system-user tokens can expose WABAs directly even when /me/businesses is empty.
  if (!accountMap.size) {
    try {
      const direct = await getAllPages('me/whatsapp_business_accounts', token, version, { fields: 'id,name,currency,timezone_id,message_template_namespace' });
      direct.forEach((waba) => accountMap.set(waba.id, waba));
    } catch { /* The business edges above are the standard path. */ }
  }

  const accounts = await Promise.all([...accountMap.values()].map(async (waba) => {
    const [phones, templates] = await Promise.all([
      getAllPages(`${waba.id}/phone_numbers`, token, version, { fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput' }),
      getAllPages(`${waba.id}/message_templates`, token, version, { fields: 'id,name,language,category,status,components,quality_score' }),
    ]);
    return {
      metaId: waba.id, name: waba.name, businessId: waba.businessId, businessName: waba.businessName,
      currency: waba.currency, timezoneId: waba.timezone_id, messageTemplateNamespace: waba.message_template_namespace,
      phones: phones.map((phone) => ({ metaId: phone.id, displayPhoneNumber: phone.display_phone_number, verifiedName: phone.verified_name, qualityRating: phone.quality_rating, codeVerificationStatus: phone.code_verification_status, platformType: phone.platform_type, throughput: phone.throughput })),
      templates: templates.map((template) => ({ metaId: template.id, name: template.name, language: template.language, category: template.category, status: template.status, components: template.components, qualityScore: template.quality_score })),
    };
  }));
  return { profile, accounts, discoveredBusinesses: businessMap.size };
};
