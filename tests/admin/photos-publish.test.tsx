import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotoGrid } from "@/components/admin/photo-grid";
import { PublishPanel } from "@/components/admin/publish-panel";
import { WizardSteps } from "@/components/admin/wizard-steps";
import type { ProductImageWithUrl } from "@/modules/media/list-product-images";
import type { AdminProduct } from "@/modules/products/get-admin-product";
import { buildChecklist } from "@/modules/products/publish-checklist";

const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const noop = async () => {};

describe("WizardSteps com quatro passos", () => {
  it("produto novo: só o passo atual; os demais sem link", () => {
    const html = renderToStaticMarkup(<WizardSteps current="data" />);
    for (const label of ["Dados do produto", "Cores e tamanhos", "Fotos", "Publicar"]) expect(html).toContain(label);
    expect(html).not.toContain("<a ");
  });

  it("produto salvo: todos os outros passos viram link", () => {
    const html = renderToStaticMarkup(<WizardSteps current="photos" productId={ID} />);
    expect(html).toContain(`href="/admin/produtos/${ID}"`);
    expect(html).toContain(`href="/admin/produtos/${ID}/opcoes"`);
    expect(html).toContain(`href="/admin/produtos/${ID}/publicar"`);
    expect(html).not.toContain(`href="/admin/produtos/${ID}/fotos"`);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
});

const image = (n: number, overrides: Partial<ProductImageWithUrl> = {}): ProductImageWithUrl => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  productId: ID,
  optionValueId: null,
  storagePath: `${ID}/f${n}.png`,
  altText: "",
  position: n - 1,
  url: `http://storage.test/f${n}.png?token=abc`,
  ...overrides,
});

describe("PhotoGrid", () => {
  const colors = [
    { id: "c-rosa", label: "Rosa" },
    { id: "c-azul", label: "Azul" },
  ];
  const render = (images: ProductImageWithUrl[], palette = colors) =>
    renderToStaticMarkup(
      <PhotoGrid
        productId={ID}
        images={images}
        colors={palette}
        returnTo={`/admin/produtos/${ID}/fotos`}
        updateImage={noop}
        moveImage={noop}
        deleteImage={noop}
      />,
    );

  it("sem fotos, explica que é preciso ao menos uma para publicar", () => {
    expect(render([])).toContain("Envie ao menos uma para poder publicar");
  });

  it("a primeira foto é a capa; mostra posição, cor e texto alternativo", () => {
    const html = render([
      image(1, { altText: "Vestido rosa de frente", optionValueId: "c-rosa" }),
      image(2),
    ]);
    expect(html.match(/>Capa</g)).toHaveLength(1);
    expect(html).toContain("Foto 1 de 2");
    expect(html).toContain("Cor: Rosa");
    expect(html).toContain("Foto geral");
    expect(html).toContain('alt="Vestido rosa de frente"');
    expect(html).toContain('alt="Foto 2 do produto"');
  });

  it("subir a primeira e descer a última ficam desativados", () => {
    const html = render([image(1), image(2), image(3)]);
    const buttons = html.match(/<button[^>]*aria-label="Mover a foto \d para (antes|depois)"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(6);
    expect(buttons.filter((b) => b.includes('disabled=""'))).toEqual([
      expect.stringContaining('aria-label="Mover a foto 1 para antes"'),
      expect.stringContaining('aria-label="Mover a foto 3 para depois"'),
    ]);
  });

  it("cada formulário leva os ids e a volta para a própria tela", () => {
    const html = render([image(1)]);
    expect(html).toContain('name="imageId" value="00000000-0000-4000-8000-000000000001"');
    expect(html).toContain(`name="returnTo" value="/admin/produtos/${ID}/fotos"`);
    expect(html).toContain('name="direction" value="up"');
  });

  it("excluir exige confirmação", () => {
    const html = render([image(1)]);
    expect(html).toContain("<details");
    expect(html).toContain("Confirmar exclusão");
  });

  it("produto sem cores não mostra o seletor de cor", () => {
    expect(render([image(1)], [])).not.toContain("Aparece quando a cor escolhida for");
  });

  it("foto sem URL mostra aviso em vez de imagem quebrada, e o texto da descrição é escapado", () => {
    const html = render([image(1, { url: null, altText: '"><script>x</script>' })]);
    expect(html).toContain("Pré-visualização indisponível");
    expect(html).not.toContain("<script>x</script>");
  });
});

const product = (overrides: Partial<AdminProduct> = {}): AdminProduct => ({
  id: ID,
  slug: "vestido",
  name: "Vestido",
  description: "",
  categoryId: null,
  basePriceCents: 7990,
  status: "draft",
  options: [
    {
      id: "o1",
      code: "cor",
      name: "Cor",
      position: 0,
      values: [
        { id: "v1", code: "rosa", label: "Rosa", position: 0 },
        { id: "v2", code: "azul", label: "Azul", position: 1 },
      ],
    },
  ],
  variants: [
    { id: "a1", values: { cor: "rosa" }, priceOverrideCents: null, effectivePriceCents: 7990, isAvailable: true, position: 0 },
    { id: "a2", values: { cor: "azul" }, priceOverrideCents: 0, effectivePriceCents: 0, isAvailable: false, position: 1 },
  ],
  publicationIssues: [],
  ...overrides,
});

const renderPanel = (p: AdminProduct, imageCount: number) =>
  renderToStaticMarkup(
    <PublishPanel
      product={p}
      checklist={buildChecklist(p, imageCount)}
      returnTo={`/admin/produtos/${ID}/publicar`}
      changeStatus={noop}
      toggleAvailability={noop}
    />,
  );

describe("PublishPanel", () => {
  it("rascunho pronto: checklist completo e botão de publicar", () => {
    const html = renderPanel(product(), 1);
    expect(html).toContain("Antes de publicar");
    expect(html).toContain("Tudo pronto");
    expect(html).toContain('name="intent" value="publish"');
    expect(html).toContain("Publicar produto");
    expect(html).not.toContain("Completar");
  });

  it("rascunho sem foto: aponta o que falta e leva ao passo", () => {
    const html = renderPanel(product(), 0);
    expect(html).toContain("Adicione ao menos uma foto.");
    expect(html).toContain(`href="/admin/produtos/${ID}/fotos"`);
    expect(html).toContain("Complete os itens acima");
    expect(html).toContain("falta completar");
  });

  it("publicado: disponibilidade por combinação com preço efetivo e botão de alternar", () => {
    const html = renderPanel(product({ status: "published" }), 1);
    expect(html).toContain("Rosa");
    expect(html).toContain("Azul");
    expect(html).toMatch(/R\$\s79,90/);
    expect(html).toMatch(/R\$\s0,00/);
    expect(html).toContain("Marcar como indisponível");
    expect(html).toContain("Marcar como disponível");
    expect(html).toContain('name="available" value="false"');
    expect(html).toContain('name="available" value="true"');
    expect(html).toContain('name="intent" value="unpublish"');
    expect(html).toContain('name="intent" value="archive"');
    expect(html).not.toContain('name="intent" value="publish"');
  });

  it("arquivado só oferece reativar", () => {
    const html = renderPanel(product({ status: "archived" }), 1);
    expect(html).toContain('name="intent" value="reactivate"');
    expect(html).not.toContain('name="intent" value="publish"');
    expect(html).not.toContain("Disponibilidade");
  });

  it("produto simples publicado mostra 'Produto único'", () => {
    const html = renderPanel(
      product({
        status: "published",
        options: [],
        variants: [
          { id: "a1", values: {}, priceOverrideCents: null, effectivePriceCents: 5000, isAvailable: true, position: 0 },
        ],
      }),
      1,
    );
    expect(html).toContain("Produto único");
  });
});
