import { useEffect } from "react";

// Falha ao carregar um arquivo do app (publicação nova no meio da sessão ou
// conexão interrompida no celular): recarregar busca a versão atual dos módulos
// em vez de deixar a tela em branco. Uma recarga por minuto evita laço.
const MODULE_ERROR =
  /importing a module script|dynamically imported module|module script failed|does not provide an export named|Unexpected token '<'/i;
const KEY = "paracolor-module-reload";

function isModuleError(event) {
  const message = String(event?.reason?.message || event?.reason || event?.message || "");
  return MODULE_ERROR.test(message);
}

export default function ModuleRecovery() {
  useEffect(() => {
    const recover = (event) => {
      if (!isModuleError(event)) return;
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(KEY) || 0);
      } catch {
        last = 0;
      }
      if (Date.now() - last < 60000) return;
      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* navegador sem armazenamento: segue com uma recarga simples */
      }
      window.location.reload();
    };

    window.addEventListener("unhandledrejection", recover);
    window.addEventListener("error", recover, true);
    return () => {
      window.removeEventListener("unhandledrejection", recover);
      window.removeEventListener("error", recover, true);
    };
  }, []);

  return null;
}