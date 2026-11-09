import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export default function InstallAppNotice({ install }) {
  const { platform, inviteOpen, guideOpen, nativeReady, openInstall, dismiss, closeGuide } = install;
  const ios = platform === "ios";
  return (
    <>
      {inviteOpen && (
        <section
          aria-label="Convite para instalar a Paracolor"
          className="fixed inset-x-4 bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-40 mx-auto max-w-sm rounded-2xl border border-gold/40 bg-card p-4 text-card-foreground shadow-xl"
        >
          <div className="flex items-start gap-3">
            <img src="/icons/paracolor-192.png" alt="" width="44" height="44" className="h-11 w-11 shrink-0 rounded-xl" />
            <div>
              <p className="font-semibold">Adicione a Paracolor à tela inicial</p>
              <p className="mt-1 text-sm text-muted-foreground">Abra a loja com um toque para enviar fotos e acompanhar seus pedidos.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={dismiss}>Agora não</Button>
            <Button type="button" size="sm" onClick={openInstall}>Adicionar</Button>
          </div>
        </section>
      )}
      <Dialog open={guideOpen} onOpenChange={(open) => { if (!open) closeGuide(); }}>
        <DialogContent className="max-h-[90dvh] w-[92vw] max-w-md overflow-y-auto rounded-2xl">
          <DialogTitle className="pr-5">Adicionar a Paracolor à tela inicial</DialogTitle>
          <DialogDescription>
            {ios ? "Faça a instalação pelo Safari." : "Faça a instalação pelo menu do Chrome."}
          </DialogDescription>
          {ios ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Abra esta página no <strong>Safari</strong> e toque em <strong>Compartilhar</strong> (ícone de seta para cima). Se necessário, abra primeiro o menu da página.</li>
              <li>Toque em <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Ative <strong>Abrir como App da Web</strong> se a opção aparecer e confirme em <strong>Adicionar</strong>.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Abra esta página no <strong>Chrome</strong> e toque no menu <strong>⋮</strong>.</li>
              <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong> e confirme.</li>
            </ol>
          )}
          <p className="text-xs text-muted-foreground">Se você abriu o link em outro aplicativo, use o menu dele para abrir a página no {ios ? "Safari" : "Chrome"}.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={closeGuide}>Fechar instruções</Button>
            {!ios && nativeReady && <Button type="button" size="sm" onClick={openInstall}>Instalar agora</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
