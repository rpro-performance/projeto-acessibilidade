// Service worker mínimo: permite instalar o Veículo Mais como app no Chrome.
// Não guarda nada em cache; tudo vem sempre do servidor local.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
