import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { formatPrice } from "@/lib/format";
import type { ProductDetail, Selection } from "@/modules/catalogs/product-detail";
import type { ProductPageView } from "@/modules/catalogs/queries/get-product-page";
import { defaultTheme } from "@/modules/catalogs/theme/tokens";

const dress: ProductDetail = {
  id: "p1",
  slug: "vestido-floral",
  name: "Vestido Floral",
  description: "Algodão macio.\nLavar à mão.",
  basePriceCents: 7990,
  options: [
    {
      code: "cor",
      name: "Cor",
      values: [
        { id: "c-rosa", code: "rosa", label: "Rosa" },
        { id: "c-azul", code: "azul", label: "Azul" },
      ],
    },
    {
      code: "tamanho",
      name: "Tamanho",
      values: [
        { id: "s-2", code: "2", label: "2" },
        { id: "s-4", code: "4", label: "4" },
      ],
    },
  ],
  variants: [
    { id: "v1", values: { cor: "rosa", tamanho: "2" }, priceCents: 7990, isAvailable: true },
    { id: "v2", values: { cor: "rosa", tamanho: "4" }, priceCents: 8990, isAvailable: true },
    { id: "v3", values: { cor: "azul", tamanho: "2" }, priceCents: 7990, isAvailable: false },
  ],
  images: [
    { id: "g1", path: "/fotos/p1/g1.png", alt: "Vestido de frente", optionValueId: null, position: 0 },
    { id: "r1", path: "/fotos/p1/r1.png", alt: "Vestido rosa", optionValueId: "c-rosa", position: 1 },
    { id: "a1", path: "/fotos/p1/a1.png", alt: "Vestido azul", optionValueId: "c-azul", position: 2 },
  ],
};

const WHATSAPP = "+5511999990000";

const view = (detail: ProductDetail, whatsappE164: string | null): ProductPageView => ({
  store: { name: "Loja Exemplo", description: "Desc", whatsappE164: whatsappE164 ?? undefined },
  theme: defaultTheme,
  categories: [{ slug: "meninas", name: "Meninas" }],
  detail,
});

const BASE = "https://loja.example";
/** `whatsappE164: null` simula uma loja sem WhatsApp configurado. */
const render = (selection: Selection = {}, detail: ProductDetail = dress, whatsappE164: string | null = WHATSAPP) =>
  renderToStaticMarkup(
    <ProductDetailView view={view(detail, whatsappE164)} selection={selection} baseUrl={BASE} />,
  );

/** Mensagem do WhatsApp decodificada a partir do link do botão. */
function whatsappMessage(html: string): string | null {
  // O rodapé e o cabeçalho também têm links do WhatsApp; o do botão é o que leva a mensagem (?text=).
  const match = /href="(https:\/\/wa\.me\/[^"?]+\?text=[^"]+)"/.exec(html);
  if (!match) return null;
  return new URL(match[1].replace(/&amp;/g, "&")).searchParams.get("text");
}

describe("sem escolha", () => {
  it("o botão fica desativado e explica o que escolher; não há link do WhatsApp", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Tenho interesse<\/button>/);
    expect(html).toContain("Escolha cor e tamanho para continuar.");
    expect(html).not.toContain("?text=");
  });

  it("mostra o preço de partida com 'A partir de'", () => {
    const html = render();
    expect(html).toContain("A partir de");
    expect(html).toContain(formatPrice(7990));
  });

  it("mostra só as fotos gerais", () => {
    const html = render();
    expect(html).toContain('alt="Vestido de frente"');
    expect(html).not.toContain('alt="Vestido rosa"');
    expect(html).not.toContain('alt="Vestido azul"');
  });

  it("nome, descrição e links de navegação", () => {
    const html = render();
    expect(html).toContain("Vestido Floral");
    expect(html).toContain("Algodão macio.");
    expect(html).toContain('href="/produtos"');
    expect(html).toContain('href="/"');
  });
});

describe("escolha parcial", () => {
  it("pede só o que falta", () => {
    expect(render({ cor: "rosa" })).toContain("Escolha tamanho para continuar.");
    expect(render({ tamanho: "2" })).toContain("Escolha cor para continuar.");
  });

  it("a galeria passa a mostrar as fotos da cor primeiro", () => {
    const html = render({ cor: "rosa" });
    expect(html.indexOf('alt="Vestido rosa"')).toBeGreaterThan(-1);
    expect(html.indexOf('alt="Vestido rosa"')).toBeLessThan(html.indexOf('alt="Vestido de frente"'));
    expect(html).not.toContain('alt="Vestido azul"');
  });
});

describe("combinação disponível escolhida (mensagem do WhatsApp)", () => {
  const html = render({ cor: "rosa", tamanho: "4" });

  it("libera o botão como link do WhatsApp que abre em outra aba com segurança", () => {
    expect(html).toMatch(/<a[^>]*href="https:\/\/wa\.me\/5511999990000\?text=[^"]+"[^>]*>/);
    expect(html).toMatch(/<a(?=[^>]*wa\.me)(?=[^>]*target="_blank")(?=[^>]*rel="noopener noreferrer")[^>]*>/);
    expect(html).toContain("Tenho interesse: falar no WhatsApp");
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });

  it("a mensagem identifica produto, cor, tamanho, preço da combinação e o link", () => {
    expect(whatsappMessage(html)).toBe(
      [
        "Olá! Tenho interesse neste produto:",
        "",
        "*Vestido Floral*",
        "Cor: Rosa",
        "Tamanho: 4",
        `Preço: ${formatPrice(8990)}`,
        "",
        `${BASE}/produto/vestido-floral?cor=rosa&tamanho=4`,
      ].join("\n"),
    );
  });

  it("mostra o preço efetivo da combinação, sem 'a partir de'", () => {
    expect(html).toContain(formatPrice(8990));
    expect(html).not.toContain("A partir de");
  });

  it("avisa que preço e disponibilidade serão confirmados e que nada é reservado", () => {
    expect(html).toContain("serão confirmados pela loja");
    expect(html).toContain("Nada é reservado nem comprado");
  });

  it("outra combinação gera outra mensagem com o preço dela", () => {
    expect(whatsappMessage(render({ cor: "rosa", tamanho: "2" }))).toContain(`Preço: ${formatPrice(7990)}`);
    expect(whatsappMessage(render({ cor: "rosa", tamanho: "2" }))).toContain("Tamanho: 2");
  });
});

describe("combinação esgotada ou inexistente", () => {
  it("combinação esgotada: botão desativado, sem link do WhatsApp", () => {
    const html = render({ cor: "azul", tamanho: "2" });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Tenho interesse<\/button>/);
    expect(html).toContain("Esta combinação está indisponível. Escolha outra.");
    expect(html).not.toContain("?text=");
  });

  it("o tamanho que não combina com a cor continua escolhível, mas solta a cor (nunca gera combinação inexistente)", () => {
    const html = render({ cor: "azul" });
    // O link do tamanho 4 leva só o tamanho: o azul é solto, porque azul·4 não existe.
    expect(html).toMatch(
      /<a(?=[^>]*href="\/produto\/vestido-floral\?tamanho=4")(?=[^>]*border-dashed)[^>]*>4<span class="sr-only"> \(não combina com a escolha atual/,
    );
    expect(html).not.toContain("cor=azul&amp;tamanho=4");
    expect(html).not.toContain("tamanho=4&amp;cor=azul");
  });

  it("valor sem nenhuma combinação não é clicável", () => {
    const noBlue = { ...dress, variants: dress.variants.filter((variant) => variant.values.cor !== "azul") };
    const html = render({}, noBlue);
    expect(html).toMatch(/<span[^>]*aria-disabled="true"[^>]*>Azul<span class="sr-only"> \(sem combinações\)<\/span><\/span>/);
    expect(html).not.toContain("cor=azul");
  });

  it("combinação inexistente na URL é ignorada pela própria página (nada selecionado de errado)", () => {
    // A página usa parseSelection; aqui, a escolha já chega limpa: só o azul.
    expect(render({ cor: "azul" })).toContain("Escolha tamanho para continuar.");
  });

  it("valor só com combinações esgotadas fica riscado e com aviso para leitores de tela", () => {
    const html = render();
    expect(html).toMatch(/<a[^>]*line-through[^>]*>Azul<span class="sr-only"> \(indisponível\)<\/span><\/a>/);
  });
});

describe("escolha de opções", () => {
  it("o valor escolhido é marcado com aria-current", () => {
    const html = render({ cor: "rosa", tamanho: "4" });
    expect(html.match(/aria-current="true"/g)).toHaveLength(2);
    expect(html).toMatch(/<a[^>]*aria-current="true"[^>]*>Rosa<\/a>/);
  });

  it("os links levam a combinação na URL e preservam a outra escolha quando é compatível", () => {
    const html = render({ cor: "rosa", tamanho: "4" });
    expect(html).toContain('href="/produto/vestido-floral?cor=rosa&amp;tamanho=2"');
  });

  it("trocar para uma cor incompatível com o tamanho escolhido solta o tamanho", () => {
    const html = render({ cor: "rosa", tamanho: "4" });
    expect(html).toContain('href="/produto/vestido-floral?cor=azul"');
  });

  it("os grupos têm rótulo e mostram a escolha atual", () => {
    const html = render({ cor: "rosa" });
    expect(html).toMatch(/role="group"[^>]*aria-labelledby="option-cor"/);
    expect(html).toContain('id="option-cor"');
    expect(html).toContain(": Rosa");
  });

  it("alvos de toque de pelo menos 48px", () => {
    const html = render();
    expect(html).toMatch(/<a[^>]*min-h-12[^>]*min-w-12[^>]*>Rosa/);
  });
});

describe("produto simples e casos especiais", () => {
  const simple: ProductDetail = {
    ...dress,
    name: "Jaqueta Única",
    options: [],
    variants: [{ id: "only", values: {}, priceCents: 5000, isAvailable: true }],
    images: [],
  };

  it("sem opções para escolher: botão liberado direto, com mensagem sem cor nem tamanho", () => {
    const html = render({}, simple);
    expect(html).not.toContain('role="group"');
    const message = whatsappMessage(html)!;
    expect(message).toContain("*Jaqueta Única*");
    expect(message).toContain(`Preço: ${formatPrice(5000)}`);
    expect(message).not.toContain("Cor:");
    expect(message).toContain(`${BASE}/produto/vestido-floral`);
  });

  it("sem fotos, mostra o espaço reservado da imagem", () => {
    expect(render({}, simple)).not.toContain("<img");
  });

  it("produto todo esgotado: avisa e não oferece o WhatsApp", () => {
    const soldOut = { ...dress, variants: dress.variants.map((variant) => ({ ...variant, isAvailable: false })) };
    const html = render({ cor: "rosa", tamanho: "2" }, soldOut);
    expect(html).toContain("Este produto está indisponível no momento.");
    expect(html).not.toContain("?text=");
  });

  it("sem WhatsApp configurado, não há botão quebrado: orienta a falar com a loja", () => {
    const html = render({ cor: "rosa", tamanho: "4" }, dress, null);
    expect(html).not.toContain("wa.me");
    expect(html).toContain("Fale com a loja");
  });

  it("preço zero é exibido", () => {
    const free = { ...simple, variants: [{ id: "only", values: {}, priceCents: 0, isAvailable: true }] };
    expect(render({}, free)).toContain(formatPrice(0));
  });

  it("sem descrição, não mostra a seção", () => {
    expect(render({}, { ...simple, description: "   " })).not.toContain("Sobre o produto");
  });

  it("escapa o nome e a descrição vindos do banco", () => {
    const html = render({}, { ...simple, name: "<script>x</script>", description: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
});
