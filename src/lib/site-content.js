import { AREAS, HERO_IMAGE, STUDIO_COVER_FALLBACK } from "@/lib/areas";

/**
 * Registry of every editable text and image of the public site.
 * Defaults are the copy shipped with the site; the admin panel only stores
 * the fields the store owner actually changed.
 */

const AREA_FIELDS = AREAS.flatMap((area) => [
  { key: `area.${area.key}.label`, label: `Nome da área — ${area.label}`, default: area.label },
  { key: `area.${area.key}.tagline`, label: `Descrição — ${area.label}`, type: "textarea", default: area.tagline },
  { key: `area.${area.key}.cta`, label: `Chamada do botão — ${area.label}`, default: area.cta },
  { key: `area.${area.key}.image`, label: `Foto — ${area.label}`, type: "image", default: area.image, hint: `Imagem de destaque da área ${area.label}.`, pixelSpec: "1200 × 900 px (proporção 4:3), mínimo recomendado; mantenha o assunto principal no centro." },
]);

export const CONTENT_GROUPS = [
  {
    id: "brand",
    label: "Logomarca, favicon e rodapé",
    fields: [
      { key: "brand.logo", label: "Logomarca do site", type: "image", hint: "PNG com fundo transparente, exibida no topo do site.", pixelSpec: "800 × 200 px (proporção 4:1), recomendado; versão PNG transparente." },
      { key: "brand.favicon", label: "Favicon (ícone da aba do navegador)", type: "image", hint: "Imagem quadrada para a aba do navegador.", pixelSpec: "512 × 512 px (proporção 1:1), recomendado." },
      { key: "brand.tagline", label: "Assinatura ao lado da logomarca", default: "laboratório fotográfico" },
      { key: "brand.footer_text", label: "Texto institucional do rodapé", type: "textarea", default: "Laboratório fotográfico e ateliê de impressão. Suas memórias impressas com cuidado, do celular para o papel." },
      { key: "nav.servicos", label: "Nome do link de Serviços no menu", default: "Serviços" },
      { key: "nav.estudio", label: "Nome do link do Estúdio no menu", default: "Estúdio Fotográfico" },
    ],
  },
  {
    id: "home_hero",
    label: "Home — topo",
    fields: [
      { key: "home.hero.badge", label: "Selo acima do título", default: "Revelação com cuidado de ateliê" },
      { key: "home.hero.title", label: "Título (uma linha por linha)", type: "textarea", default: "Suas memórias\nmerecem" },
      { key: "home.hero.highlight", label: "Palavra destacada em dourado", default: "papel" },
      { key: "home.hero.subtitle", label: "Texto do topo", type: "textarea", default: "Revelação de fotos, polaroids com legenda e banners impressos com qualidade de laboratório. Você envia, ajusta o enquadramento e a gente imprime — do jeito que você viu na tela." },
      { key: "home.hero.image", label: "Foto principal do topo", type: "image", default: HERO_IMAGE, pixelSpec: "1600 × 1300 px (proporção 16:13), mínimo recomendado; mantenha o assunto no centro, pois o enquadramento muda no celular." },
      { key: "home.hero.meta1_label", label: "Destaque 1 — rótulo", default: "Papel fotográfico" },
      { key: "home.hero.meta1_value", label: "Destaque 1 — valor", default: "300 DPI de verdade" },
      { key: "home.hero.meta2_label", label: "Destaque 2 — rótulo", default: "Prévia do corte" },
      { key: "home.hero.meta2_value", label: "Destaque 2 — valor", default: "Fiel ao impresso" },
      { key: "home.hero.meta3_label", label: "Destaque 3 — rótulo", default: "Seus arquivos" },
      { key: "home.hero.meta3_value", label: "Destaque 3 — valor", default: "Privados e temporários" },
      { key: "home.hero.seal_outer_text", label: "Selo giratório — texto circular", default: "PARACOLOR · DESDE 1994", hint: "Texto ao redor do selo da página inicial. Use uma frase curta para caber bem no círculo." },
      { key: "home.hero.seal_year", label: "Selo giratório — texto central", default: "1994", hint: "Texto exibido no centro do selo da página inicial." },
    ],
  },
  {
    id: "trust",
    label: "Selos de confiança (abaixo do topo)",
    fields: [
      { key: "home.trust1.text", label: "Selo 1 — texto", default: "Produção e conferência manual antes do aviso de retirada" },
      { key: "home.trust2.title", label: "Selo 2 — título", default: "Retirada na loja" },
      { key: "home.trust2.text", label: "Selo 2 — texto", default: "Avisamos você assim que o pedido estiver pronto" },
      { key: "home.trust3.title", label: "Selo 3 — título", default: "Pagamento seguro" },
      { key: "home.trust3.text", label: "Selo 3 — texto", default: "Pix ou cartão em ambiente protegido, com confirmação automática" },
      { key: "home.trust4.title", label: "Selo 4 — título", default: "Fotos privadas" },
      { key: "home.trust4.text", label: "Selo 4 — texto", default: "Armazenamento privado — originais apagados em {retencao} dias", hint: "Use {retencao} para os dias de retenção configurados." },
    ],
  },
  {
    id: "areas",
    label: "Áreas da loja",
    fields: [
      { key: "home.areas.eyebrow", label: "Chamada da seção", default: "Escolha por onde começar" },
      { key: "home.areas.title", label: "Título da seção", default: "Três estúdios dentro da mesma loja" },
      { key: "home.areas.note", label: "Texto ao lado do título", type: "textarea", default: "Cada área tem seu próprio editor, mas tudo vai para o mesmo carrinho e o mesmo pedido." },
      ...AREA_FIELDS,
    ],
  },
  {
    id: "quantity",
    label: "Home — desconto por quantidade",
    fields: [
      { key: "home.quantity.eyebrow", label: "Chamada da seção", default: "Desconto por quantidade" },
      { key: "home.quantity.title", label: "Título (uma linha por linha)", type: "textarea", default: "Quanto mais fotos,\nmenor o preço por unidade" },
      { key: "home.quantity.text", label: "Texto", type: "textarea", default: "O desconto entra sozinho no carrinho na foto {tamanho}, e tamanhos do mesmo grupo somam juntos para chegar na próxima faixa.", hint: "Use {tamanho} para o formato de referência." },
    ],
  },
  {
    id: "steps",
    label: "Home — como funciona",
    fields: [
      { key: "home.steps.eyebrow", label: "Chamada da seção", default: "Como funciona" },
      { key: "home.steps.title", label: "Título da seção", default: "Do celular para a parede em quatro passos" },
      { key: "home.steps.1.title", label: "Passo 1 — título", default: "Envie suas fotos" },
      { key: "home.steps.1.text", label: "Passo 1 — texto", type: "textarea", default: "Escolha do celular ou do computador quantas quiser. Elas chegam em qualidade original." },
      { key: "home.steps.2.title", label: "Passo 2 — título", default: "Ajuste o enquadramento" },
      { key: "home.steps.2.text", label: "Passo 2 — texto", type: "textarea", default: "Escolha o tamanho e veja exatamente o que vai ser cortado, com aviso de rosto cortado." },
      { key: "home.steps.3.title", label: "Passo 3 — título", default: "Finalize o pedido" },
      { key: "home.steps.3.text", label: "Passo 3 — texto", type: "textarea", default: "Um só carrinho para fotos, polaroids, banners e personalizados." },
      { key: "home.steps.4.title", label: "Passo 4 — título", default: "Receba na loja" },
      { key: "home.steps.4.text", label: "Passo 4 — texto", type: "textarea", default: "Produzimos com cuidado e avisamos quando estiver pronto para retirar." },
    ],
  },
  {
    id: "advantages",
    label: "Home — diferenciais",
    fields: [
      { key: "home.advantages.eyebrow", label: "Chamada da seção", default: "Por que a Paracolor" },
      { key: "home.advantages.title", label: "Título da seção", type: "textarea", default: "Cuidado de laboratório fotográfico, com a praticidade de comprar online" },
      { key: "home.advantages.1.title", label: "Diferencial 1 — título", default: "Prévia fiel ao impresso" },
      { key: "home.advantages.1.text", label: "Diferencial 1 — texto", type: "textarea", default: "O que você ajusta na tela é exatamente o que sai na impressão, com moldura e legenda incluídas." },
      { key: "home.advantages.2.title", label: "Diferencial 2 — título", default: "Arquivos privados" },
      { key: "home.advantages.2.text", label: "Diferencial 2 — texto", type: "textarea", default: "Suas fotos ficam em armazenamento privado, com acesso por links temporários." },
      { key: "home.advantages.3.title", label: "Diferencial 3 — título", default: "Produção acompanhada" },
      { key: "home.advantages.3.text", label: "Diferencial 3 — texto", type: "textarea", default: "Você acompanha cada etapa do pedido, da aprovação da arte até a retirada." },
      { key: "home.advantages.4.title", label: "Diferencial 4 — título", default: "Feito com cuidado" },
      { key: "home.advantages.4.text", label: "Diferencial 4 — texto", type: "textarea", default: "Papel fotográfico de verdade, conferência manual e embalagem protegida." },
    ],
  },
  {
    id: "sections",
    label: "Home — destaques e depoimentos",
    fields: [
      { key: "home.featured.eyebrow", label: "Destaques — chamada", default: "Destaques" },
      { key: "home.featured.title", label: "Destaques — título", default: "Escolhidos para você" },
      { key: "home.testimonials.eyebrow", label: "Depoimentos — chamada", default: "Quem já revelou" },
      { key: "home.testimonials.title", label: "Depoimentos — título", default: "Histórias que saíram do celular" },
    ],
  },
  {
    id: "home_gallery",
    label: "Home — galeria de clientes",
    fields: [
      { key: "home.gallery.eyebrow", label: "Chamada da seção", default: "Feito por clientes" },
      { key: "home.gallery.title", label: "Título da seção", default: "Revelações de verdade" },
      { key: "home.gallery.text", label: "Texto ao lado do título", type: "textarea", default: "Fotos impressas por quem já enviou para a Paracolor." },
    ],
  },
  {
    id: "faq",
    label: "Home — perguntas frequentes",
    fields: [
      { key: "home.faq.eyebrow", label: "Chamada da seção", default: "Dúvidas frequentes" },
      { key: "home.faq.title", label: "Título da seção", default: "Tudo que você precisa saber antes de imprimir" },
      { key: "home.faq.text", label: "Texto ao lado", type: "textarea", default: "Ficou alguma dúvida? Fale com a gente pelo WhatsApp — respondemos no horário comercial." },
      { key: "home.faq.1.q", label: "Pergunta 1", default: "Como envio minhas fotos?" },
      { key: "home.faq.1.a", label: "Resposta 1", type: "textarea", default: "Você escolhe as fotos direto do celular ou do computador, no próprio editor. Aceitamos JPG, PNG, WEBP, AVIF, HEIC do iPhone e PDF, e suas fotos originais ficam guardadas sem perda de qualidade." },
      { key: "home.faq.2.q", label: "Pergunta 2", default: "Qual a resolução mínima para uma foto ficar boa?" },
      { key: "home.faq.2.a", label: "Resposta 2", type: "textarea", default: "Trabalhamos com 300 DPI. Para 10x15 cm, a foto precisa de pelo menos 1181 x 1772 pixels. O editor avisa quando a foto é pequena para o tamanho escolhido, antes de você finalizar." },
      { key: "home.faq.3.q", label: "Pergunta 3", default: "Posso escolher a foto inteira, sem cortes?" },
      { key: "home.faq.3.a", label: "Resposta 3", type: "textarea", default: "Sim. No modo “foto inteira” a imagem aparece completa, com borda branca onde sobrar espaço. No modo “preenchida” ela ocupa todo o papel e pode cortar as extremidades — você decide foto por foto ou para todas de uma vez." },
      { key: "home.faq.4.q", label: "Pergunta 4", default: "Como funciona a aprovação da arte?" },
      { key: "home.faq.4.a", label: "Resposta 4", type: "textarea", default: "Nos produtos e banners que exigem aprovação, nossa equipe monta a arte e envia pelo WhatsApp. A produção só começa depois que você aprova pelo atendimento, e cada versão fica registrada no seu pedido." },
      { key: "home.faq.5.q", label: "Pergunta 5", default: "Como recebo meu pedido?" },
      { key: "home.faq.5.a", label: "Resposta 5", type: "textarea", default: "A retirada na loja é a opção padrão, combinada pelo WhatsApp. Também é possível combinar envio por transportadora ou Correios quando disponível no checkout." },
      { key: "home.faq.6.q", label: "Pergunta 6", default: "Meus arquivos ficam públicos?" },
      { key: "home.faq.6.a", label: "Resposta 6", type: "textarea", default: "Não. As fotos ficam em armazenamento privado, acessíveis apenas por links temporários para você e para a produção da Paracolor." },
    ],
  },
  {
    id: "cta",
    label: "Home — faixa final",
    fields: [
      { key: "home.cta.eyebrow", label: "Chamada da seção", default: "Comece agora" },
      { key: "home.cta.title", label: "Título", default: "Suas memórias ainda estão só no celular." },
      { key: "home.cta.text", label: "Texto", type: "textarea", default: "Envie as fotos, ajuste o enquadramento e receba impresso — com prévia fiel do corte e um único pedido para todas as áreas da loja." },
    ],
  },
  {
    id: "home_studio",
    label: "Home — Estúdio e estacionamento",
    fields: [
      { key: "home.studio.eyebrow", label: "Atalho do estúdio — chamada", default: "Estúdio fotográfico" },
      { key: "home.studio.title", label: "Atalho do estúdio — título", default: "Sua história contada em ensaio" },
      { key: "home.studio.text", label: "Atalho do estúdio — texto", type: "textarea", default: "São 6 estúdios totalmente equipados, atendimento por ordem de chegada e você paga apenas as fotos que escolher." },
      { key: "home.studio.cta", label: "Atalho do estúdio — botão", default: "Conheça o Estúdio Fotográfico" },
      { key: "home.studio.image", label: "Atalho do estúdio — foto", type: "image", hint: "Foto real do estúdio exibida no cartão da página inicial.", pixelSpec: "1200 × 900 px (proporção 4:3), mínimo recomendado; mantenha o assunto no centro." },
      { key: "home.parking.text", label: "Destaque de estacionamento na home", default: "Estacionamento próprio ao lado da loja." },
    ],
  },
  {
    id: "servicos",
    label: "Página de serviços",
    fields: [
      { key: "page.servicos.eyebrow", label: "Chamada da página", default: "O que a Paracolor faz" },
      { key: "page.servicos.title", label: "Título da página", default: "Serviços prestados" },
      { key: "page.servicos.text", label: "Texto de abertura", type: "textarea", default: "Do laboratório fotográfico ao estúdio: veja o que a loja faz e fale com a equipe para receber um orçamento do seu projeto." },
      { key: "page.servicos.empty", label: "Texto quando não há serviços publicados", type: "textarea", default: "A loja ainda não publicou serviços neste catálogo. Fale com a equipe para saber o que está disponível." },
      { key: "page.servicos.note", label: "Rodapé da página", type: "textarea", default: "Precisa de algo que não está na lista? Fale com a equipe e conte o que você imagina." },
      { key: "page.servicos.card_title", label: "Serviços — cartão lateral (título)", default: "Atendimento direto com quem produz" },
      { key: "page.servicos.card_text", label: "Serviços — cartão lateral (texto)", type: "textarea", default: "Cada serviço tem um caminho de contato próprio: orçamento pelo site, WhatsApp ou e-mail. A resposta vem da equipe da loja, sem intermediários." },
    ],
  },
  {
    id: "estudio",
    label: "Página do Estúdio Fotográfico",
    fields: [
      { key: "page.estudio.title", label: "Título da página", default: "Estúdio Fotográfico" },
      { key: "page.estudio.text", label: "Apresentação do estúdio", type: "textarea", default: "Um estúdio dentro da Paracolor para registrar o que você quer lembrar: a equipe acompanha o ensaio, você escolhe as fotos com calma e sai com elas impressas no mesmo lugar." },
      { key: "page.estudio.cover", label: "Imagem de capa — foto de fundo do topo", type: "image", default: STUDIO_COVER_FALLBACK, hint: "Esta é a foto de fundo grande que aparece atrás do título no topo da página do Estúdio. A prévia mostra a imagem atual; envie outra e salve o conteúdo para substituí-la.", pixelSpec: "1920 × 1400 px (aprox. 4:3), recomendado; deixe o assunto principal centralizado para evitar cortes no celular." },
      { key: "page.estudio.cover_alt", label: "Descrição da capa (acessibilidade)", default: "Estúdio fotográfico da Paracolor" },
      { key: "page.estudio.highlight_image", label: "Faixa “6 estúdios” — foto de fundo", type: "image", default: "/loja/estudio-destaque.webp", pixelSpec: "1920 × 840 px (proporção aproximada 2,3:1), recomendado; mantenha o assunto no centro." },
      { key: "page.estudio.backstage", label: "Bastidores (foto abaixo das galerias)", type: "image", default: "/loja/estudio-bastidores.webp", hint: "A imagem aparece inteira e mantém a proporção original; a altura do quadro acompanha a foto sem achatá-la ou cortá-la.", pixelSpec: "1920 × 640 px (proporção 3:1), recomendado; a imagem é exibida inteira e o quadro acompanha a proporção original, sem corte nem achatamento." },
      { key: "page.estudio.benefit1.title", label: "Diferencial 1 — título", default: "Não precisa de agendamento" },
      { key: "page.estudio.benefit1.text", label: "Diferencial 1 — texto", type: "textarea", default: "Atendimento por ordem de chegada. Mais liberdade para você!" },
      { key: "page.estudio.benefit2.title", label: "Diferencial 2 — título", default: "Fotos ilimitadas" },
      { key: "page.estudio.benefit2.text", label: "Diferencial 2 — texto", type: "textarea", default: "Durante o ensaio você faz quantas fotos quiser, com calma e sem pressa." },
      { key: "page.estudio.benefit3.title", label: "Diferencial 3 — título", default: "Pague só o que escolher" },
      { key: "page.estudio.benefit3.text", label: "Diferencial 3 — texto", type: "textarea", default: "Após o ensaio, você escolhe suas fotos favoritas e paga apenas por elas. Sem pacotes obrigatórios." },
      { key: "page.estudio.studios.title", label: "Faixa de destaque — título", default: "São 6 estúdios totalmente equipados." },
      { key: "page.estudio.studios.text", label: "Faixa de destaque — texto", type: "textarea", default: "Estrutura completa, conforto e tecnologia para uma experiência profissional." },
      { key: "page.estudio.gallery_title", label: "Galeria — título", default: "Ensaios realizados no estúdio" },
      { key: "page.estudio.gallery_text", label: "Galeria — texto", type: "textarea", default: "Trabalhos reais feitos com clientes da Paracolor." },
      { key: "page.estudio.visit_title", label: "Chamada final — título", default: "Venha conhecer o estúdio" },
      { key: "page.estudio.visit_text", label: "Chamada final — texto", type: "textarea", default: "Fale com a equipe para saber como chegar, o que esperar do ensaio e como escolher suas fotos depois." },
      { key: "page.estudio.cta", label: "Chamada final — botão", default: "Falar com a equipe" },
      { key: "page.estudio.parking", label: "Destaque de estacionamento", default: "Temos estacionamento próprio ao lado da loja." },
    ],
  },
  {
    id: "pages",
    label: "Páginas internas",
    fields: [
      { key: "page.revelacao.eyebrow", label: "Revelação — chamada", default: "Revelação de fotos" },
      { key: "page.revelacao.title", label: "Revelação — título", default: "Suas fotos no papel, do jeito que você viu" },
      { key: "page.revelacao.text", label: "Revelação — texto", type: "textarea", default: "Escolha o formato, ajuste o enquadramento foto por foto e veja exatamente o que será impresso. Nada de surpresa com cabeça cortada." },
      { key: "page.revelacao.list_title", label: "Revelação — título da lista de formatos", default: "Formatos disponíveis" },
      { key: "page.revelacao.list_note", label: "Revelação — texto acima dos formatos", type: "textarea", default: "Preço por foto. Borda branca opcional." },
      { key: "page.revelacao.cta", label: "Revelação — botão principal", default: "Enviar minhas fotos" },
      { key: "page.polaroids.eyebrow", label: "Polaroids — chamada", default: "Polaroids" },
      { key: "page.polaroids.title", label: "Polaroids — título", default: "Aquela foto instantânea, com a sua letra" },
      { key: "page.polaroids.text", label: "Polaroids — texto", type: "textarea", default: "Escolha o modelo de moldura, ajuste o enquadramento na própria polaroide e escreva na faixa inferior ou amplie a foto para ocupar esse espaço." },
      { key: "page.polaroids.cta", label: "Polaroids — botão principal", default: "Criar minhas polaroids" },
      { key: "page.polaroids.list_title", label: "Polaroids — título dos modelos", default: "Modelos de moldura" },
      { key: "page.polaroids.list_note", label: "Polaroids — texto ao lado dos modelos", type: "textarea", default: "A prévia mostra a moldura real. No editor, escolha manter a faixa inferior para legenda ou ampliar a foto até perto da borda." },
      { key: "page.banners.eyebrow", label: "Banners — chamada", default: "Banners" },
      { key: "page.banners.title", label: "Banners — título", default: "Sua marca impressa em grande" },
      { key: "page.banners.text", label: "Banners — texto", type: "textarea", default: "Lonas, faixas e banners promocionais com tamanho padrão ou personalizado, cálculo por metro quadrado e acabamento do jeito que você precisa." },
      { key: "page.banners.list_eyebrow", label: "Banners — chamada dos tamanhos", default: "Pronto para imprimir" },
      { key: "page.banners.list_title", label: "Banners — título dos tamanhos", default: "Tamanhos mais pedidos" },
      { key: "page.banners.list_note", label: "Banners — texto ao lado dos tamanhos", type: "textarea", default: "Precisa de outra medida? O orçamento é feito por metro quadrado, no tamanho exato do seu espaço." },
      { key: "page.banners.empty", label: "Banners — texto quando não há tamanhos cadastrados", type: "textarea", default: "Tamanhos sob consulta — fale com a equipe pelo botão de orçamento." },
      { key: "page.banners.cta_text", label: "Banners — faixa final", type: "textarea", default: "Faixas, lonas e banners para fachada, eventos e promoções — com conferência de arte antes da impressão." },
      { key: "page.personalizados.eyebrow", label: "Personalizados — chamada", default: "Loja de personalizados" },
      { key: "page.personalizados.title", label: "Personalizados — título", default: "Objetos do dia a dia com as suas fotos" },
      { key: "page.personalizados.text", label: "Personalizados — texto de abertura", type: "textarea", default: "Canecas, almofadas, porta-retratos e muito mais. Você envia a foto, escreve o texto e a gente produz." },
      { key: "page.personalizados.image", label: "Personalizados — foto de abertura", type: "image", hint: "Se não enviar uma imagem aqui, o site usa a foto cadastrada na área Personalizados.", pixelSpec: "1200 × 900 px (proporção 4:3), mínimo recomendado; mantenha o produto principal no centro." },
      { key: "page.fotos_ima.sample_image", label: "Fotos Ímã — foto de amostra", type: "image", hint: "Imagem exibida na abertura da página de Fotos Ímã. Você pode enviar ou trocar a foto a qualquer momento.", pixelSpec: "1200 × 900 px (proporção 4:3), recomendado; mostre os ímãs em uma composição clara e centralizada." },
      { key: "page.fotos_ima.sample_image_alt", label: "Fotos Ímã — descrição da foto de amostra", default: "Exemplos de fotos ímã personalizadas da Paracolor" },
      { key: "page.molduras.sample_image", label: "Molduras — foto de amostra", type: "image", hint: "Imagem exibida na abertura da página de Molduras. Você pode enviar ou trocar a foto a qualquer momento.", pixelSpec: "1200 × 900 px (proporção 4:3), recomendado; mostre uma foto emoldurada em um ambiente bem iluminado." },
      { key: "page.molduras.sample_image_alt", label: "Molduras — descrição da foto de amostra", default: "Exemplo de foto emoldurada da Paracolor" },
      { key: "page.albuns_books.image", label: "Álbuns e Books — foto ao lado do título", type: "image", hint: "Esta imagem aparece ao lado do título na abertura da vitrine de Álbuns e Books.", pixelSpec: "1200 × 900 px (proporção 4:3), recomendado; mantenha o álbum ou book no centro." },
      { key: "page.albuns_books.image_alt", label: "Álbuns e Books — descrição da foto", default: "Álbuns e books fotográficos da Paracolor" },
      { key: "page.molduras.eyebrow", label: "Molduras — chamada", default: "Vitrine" },
      { key: "page.molduras.title", label: "Molduras — título", default: "Molduras" },
      { key: "page.molduras.text", label: "Molduras — texto", type: "textarea", default: "Modelos, cores e tamanhos para dar acabamento às suas fotos favoritas. Consulte disponibilidade pelo WhatsApp." },
      { key: "page.molduras.note", label: "Molduras — texto do rodapé da página", type: "textarea", default: "Não achou o modelo que queria? A gente busca a moldura certa para a sua foto e para o seu espaço." },
      { key: "page.contato.eyebrow", label: "Contato — chamada", default: "Atendimento" },
      { key: "page.contato.title", label: "Contato — título", default: "Falar com a Paracolor" },
      { key: "page.contato.text", label: "Contato — texto", type: "textarea", default: "Tire dúvidas sobre formatos, prazos, aprovação de arte ou acompanhe um pedido. Respondemos no horário comercial." },
      { key: "page.contato.whatsapp_text", label: "Contato — texto do cartão de WhatsApp", type: "textarea", default: "Atendimento direto com a equipe da loja, no horário comercial." },
      { key: "page.contato.email_text", label: "Contato — texto do cartão de e-mail", type: "textarea", default: "Para orçamentos, arquivos e dúvidas sobre pedidos." },
    ],
  },
];

export const CONTENT_FIELDS = CONTENT_GROUPS.flatMap((group) => group.fields);

export const CONTENT_DEFAULTS = Object.fromEntries(
  CONTENT_FIELDS.filter((field) => typeof field.default === "string").map((field) => [field.key, field.default])
);

export const IMAGE_KEYS = new Set(CONTENT_FIELDS.filter((field) => field.type === "image").map((field) => field.key));

/** Replaces {tokens} inside editable copy with live store values. */
const defaultMedia = "https://media.base44.com/images/public/6aebd7693f7d30fc2024dc02/";
const OLD_CONTENT_DEFAULTS = {
  "area.revelacao.image": [defaultMedia + "9057474b8_generated_c016e18b.png"],
  "area.polaroid.image": [defaultMedia + "5d00b9c29_generated_10711ebd.png"],
  "area.banner.image": [defaultMedia + "1d8a2815a_generated_1ad407e5.png"],
  "area.personalizado.image": [defaultMedia + "6826100ce_generated_00c45475.png"],
  "area.moldura.image": [defaultMedia + "316be45c4_generated_93d09dca.png"],
  "home.hero.image": [defaultMedia + "52dc2aa3d_generated_a9f3a6ca.png"],
  "page.estudio.cover": [defaultMedia + "9deffabe8_generated_067660f7.jpg"],
  "page.estudio.highlight_image": [defaultMedia + "c190e344f_generated_3df8c815.jpg"],
  "page.estudio.backstage": [defaultMedia + "70fd07908_generated_6d4896fb.jpg"],
  "nav.estudio": ["Estúdio"],
  "home.studio.cta": ["Conheça o Estúdio"],
};

export function updatedContentValue(key, value) {
  if (!Object.hasOwn(OLD_CONTENT_DEFAULTS, key) || typeof value !== "string") return value;
  return OLD_CONTENT_DEFAULTS[key].includes(value.trim()) ? CONTENT_DEFAULTS[key] : value;
}

export function fillVars(text, vars = {}) {
  if (!text) return "";
  return text.replace(/\{(\w+)\}/g, (match, token) => (vars[token] ?? match));
}
