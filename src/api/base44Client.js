async function requestJson(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options, headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || body.message || "A solicitação falhou."), { status: response.status, data: body });
  return body;
}

function callEntity(entity, action, params = {}) {
  return requestJson("/api/data", { method: "POST", body: JSON.stringify({ entity, action, ...params }) });
}

function entityProxy(entity) {
  return {
    list: (options) => callEntity(entity, "list", { options }),
    filter: (query, options) => callEntity(entity, "filter", { query, options }),
    get: (id) => callEntity(entity, "get", { id }),
    count: (query) => callEntity(entity, "count", { query }),
    create: (data) => callEntity(entity, "create", { data }),
    update: (id, data) => callEntity(entity, "update", { id, data }),
    delete: (id) => callEntity(entity, "delete", { id }),
    bulkCreate: (items) => callEntity(entity, "bulkCreate", { data: { items } }),
    bulkUpdate: (items) => callEntity(entity, "bulkUpdate", { data: { items } }),
    deleteMany: (query) => callEntity(entity, "deleteMany", { query }),
    aggregate: (data) => callEntity(entity, "aggregate", { data }),
    subscribe(listener) { const timer = setInterval(() => listener?.(), 30_000); return () => clearInterval(timer); },
  };
}

const entities = new Proxy({}, { get: (_target, entity) => entityProxy(String(entity)) });

async function upload(file, visibility) {
  const form = new FormData();
  form.set("file", file);
  form.set("visibility", visibility);
  return requestJson("/api/files/upload", { method: "POST", body: form });
}

export const base44 = {
  entities,
  integrations: { Core: {
    UploadPrivateFile: ({ file }) => upload(file, "private"),
    UploadPublicFile: ({ file }) => upload(file, "public"),
    async CreateFileSignedUrl({ file_uri, expires_in }) {
      return requestJson("/api/files/sign", { method: "POST", body: JSON.stringify({ file_uri, expires_in }) });
    },
  } },
  auth: {
    hasToken: () => typeof window !== "undefined",
    setToken: () => {},
    async me() { return (await requestJson("/api/auth/me")).user; },
    async login({ email, password }) { return requestJson("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); },
    async register({ email, password }) { return requestJson("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }); },
    async verifyOtp({ email, otpCode }) { return requestJson("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, otpCode }) }); },
    async resendOtp(email) { return requestJson("/api/auth/resend", { method: "POST", body: JSON.stringify({ email }) }); },
    async resetPasswordRequest(email) { return requestJson("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }); },
    async resetPassword(data) { return requestJson("/api/auth/reset", { method: "POST", body: JSON.stringify(data) }); },
    async updateMe(data) { return requestJson("/api/auth/update", { method: "POST", body: JSON.stringify(data) }); },
    async logout() { await requestJson("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {}); window.location.assign("/"); },
    redirectToLogin(returnTo = window.location.href) { window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`); },
    async loginWithProvider() { throw new Error("Login social ainda não foi configurado nesta instalação. Use e-mail e senha."); },
  },
};
