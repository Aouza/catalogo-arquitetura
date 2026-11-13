import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductDataForm } from "@/components/admin/product-data-form";
import { StructureEditor } from "@/components/admin/structure-editor";
import { WizardSteps } from "@/components/admin/wizard-steps";
import type { FormState } from "@/modules/products/admin-product-forms";
import { addValue, emptyState, setCombo } from "@/modules/products/structure-editor";

const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const noopAction = async (): Promise<FormState> => ({});

describe("WizardSteps", () => {
  it("produto novo: passo 1 atual e passo 2 ainda sem link", () => {
    const html = renderToStaticMarkup(<WizardSteps current="data" />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Dados do produto");
    expect(html).toContain("Cores e tamanhos");
    expect(html).not.toContain("<a ");
  });

  it("produto salvo: o outro passo vira link", () => {
    const html = renderToStaticMarkup(<WizardSteps current="options" productId={ID} />);
    expect(html).toContain(`href="/admin/produtos/${ID}"`);
    expect(html).not.toContain(`href="/admin/produtos/${ID}/opcoes"`);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
});

describe("ProductDataForm", () => {
  const categories = [{ id: "c1", name: "Meninas", slug: "meninas" }];
  const defaults = { name: "", price: "", description: "", categoryId: "", slug: "" };
  const render = (mode: "create" | "edit", overrides = {}) =>
    renderToStaticMarkup(
      <ProductDataForm mode={mode} action={noopAction} categories={categories} defaults={{ ...defaults, ...overrides }} />,
    );

  it("tem campos rotulados e botão de continuar", () => {
    const html = render("create");
    for (const text of ["Nome do produto", "Preço base (R$)", "Descrição (opcional)", "Categoria", "Salvar e continuar"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("Sem categoria");
    expect(html).toContain("Meninas");
    expect(html).toContain("Personalizar o endereço");
  });

  it("no modo edição leva o id do produto e avisa sobre mudar o endereço", () => {
    const html = render("edit", { productId: ID, name: "Vestido", price: "79,90" });
    expect(html).toContain(`name="productId" value="${ID}"`);
    expect(html).toContain('value="79,90"');
    expect(html).toContain("links já compartilhados");
    expect(html).toContain("Salvar dados");
  });

  it("escapa o que vem do banco", () => {
    expect(render("edit", { productId: ID, name: '"><script>alert(1)</script>' })).not.toContain("<script>alert(1)");
  });
});

describe("StructureEditor", () => {
  const render = (initial = emptyState(), basePriceCents = 7990) =>
    renderToStaticMarkup(
      <StructureEditor productId={ID} basePriceCents={basePriceCents} initial={initial} action={noopAction} />,
    );

  it("produto novo: uma combinação 'Produto único' e o botão de salvar", () => {
    const html = render();
    expect(html).toContain("Cores");
    expect(html).toContain("Tamanhos");
    expect(html).toContain("Produto único");
    expect(html).toContain("1 de 1 combinação marcada");
    expect(html).toContain("Salvar combinações");
  });

  it("mostra todas as combinações geradas e o preço base como dica", () => {
    let state = emptyState();
    for (const c of ["Rosa", "Azul"]) state = addValue(state, "colors", c).state;
    for (const s of ["2", "4"]) state = addValue(state, "sizes", s).state;
    const html = render(state);
    for (const label of ["Rosa · 2", "Rosa · 4", "Azul · 2", "Azul · 4"]) expect(html).toContain(label);
    expect(html).toContain("4 de 4 combinações marcadas");
    expect(html).toMatch(/preço base \(R\$\s79,90\)/);
    expect(html).toContain('placeholder="79,90"');
  });

  it("envia a estrutura pronta num campo oculto, com preço próprio e zero", () => {
    let state = addValue(emptyState(), "colors", "Rosa").state;
    state = setCombo(state, "rosa|", { price: "0" });
    const html = render(state);
    const hidden = /name="structure" value="([^"]*)"/.exec(html)?.[1] ?? "";
    const structure = JSON.parse(hidden.replace(/&quot;/g, '"'));
    expect(structure.variants).toEqual([
      expect.objectContaining({ values: { cor: "rosa" }, priceOverrideCents: 0, isAvailable: true }),
    ]);
  });

  it("combinação desmarcada aparece desmarcada e com campos desativados", () => {
    const state = setCombo(addValue(emptyState(), "colors", "Rosa").state, "rosa|", { enabled: false });
    const html = render(state);
    expect(html).toContain("0 de 1 combinação marcada");
    expect(html).toContain("Marque ao menos uma combinação.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Salvar combinações/);
  });

  it("oferece sugestões de tamanho que ainda não foram adicionadas", () => {
    const html = render(addValue(emptyState(), "sizes", "P").state);
    expect(html).toContain("+ M");
    expect(html).not.toContain("+ P<");
  });

  it("cada cor e tamanho tem botão de remover com nome acessível", () => {
    const html = render(addValue(emptyState(), "colors", "Rosa").state);
    expect(html).toContain('aria-label="Remover Rosa"');
  });
});
