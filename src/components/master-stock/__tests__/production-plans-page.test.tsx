import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ProductionPlanDetailPage } from "@/components/master-stock/production-plan-detail-page";
import { ProductionPlansPage } from "@/components/master-stock/production-plans-page";
import { AppProviders } from "@/components/providers/app-providers";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function renderWithProviders(element: React.ReactElement) {
  return render(<AppProviders>{element}</AppProviders>);
}

describe("Production plans", () => {
  it("creates a new draft production plan from the dedicated plans page", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    pushMock.mockReset();
    renderWithProviders(<ProductionPlansPage />);

    expect(
      screen.getByRole("heading", { name: /^Production Plans$/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Create New Plan/i }));
    await user.type(screen.getByRole("textbox", { name: /Plan Name/i }), "Indira Week 3");
    await user.selectOptions(screen.getByRole("combobox", { name: /Source/i }), "indira");
    await user.click(screen.getByRole("button", { name: /Create Plan/i }));

    expect(
      screen.getByText(/Production plan created successfully/i),
    ).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalled();
    expect(screen.getByText(/Indira Week 3/i)).toBeInTheDocument();
    expect(screen.getByText(/0 pcs • 0 items/i)).toBeInTheDocument();
    expect(screen.getByText(/Created \d{1,2} \w{3} \d{4}/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete Indira Week 3/i }),
    ).toBeInTheDocument();
  });

  it("moves a plan from draft to completed before export becomes available", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v1",
      JSON.stringify({
        productionPlans: [
          {
            id: "plan-1",
            name: "Indira April",
            source: "indira",
            notes: "Priority",
            items: [],
            createdAt: "2026-04-17T03:00:00.000Z",
            status: "draft",
          },
        ],
      }),
    );

    renderWithProviders(<ProductionPlanDetailPage planId="plan-1" />);

    expect(
      await screen.findByRole("heading", { name: /Indira April/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^draft$/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Complete Plan/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Export PDF/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add Item/i }));
    await user.type(screen.getByPlaceholderText(/Search product or SKU/i), "4EVER");
    await user.keyboard("{Enter}");

    const quantityInput = await screen.findByDisplayValue("0");
    expect(screen.getByPlaceholderText(/Search product or SKU/i)).toBeInTheDocument();
    await waitFor(() => expect(quantityInput).toHaveFocus());
    await user.clear(quantityInput);
    await user.type(quantityInput, "15");
    await waitFor(() => expect(quantityInput).toHaveValue(15));

    await user.click(screen.getAllByRole("button", { name: /Complete Plan/i })[0]);
    expect(screen.getByText(/Mark this plan as complete\?/i)).toBeInTheDocument();
    const completeButtons = screen.getAllByRole("button", { name: /Complete Plan/i });
    await user.click(completeButtons[completeButtons.length - 1]);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Export PDF/i }).length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByRole("button", { name: /^Complete Plan$/i })).toHaveLength(0);
    expect(screen.getByRole("heading", { name: /Activity History/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Show Activity/i }));
    expect(screen.getAllByText(/Edited quantity for/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Completed plan/i)).toBeInTheDocument();
  });

  it("lets users close the add item picker with the visible close control", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v1",
      JSON.stringify({
        productionPlans: [
          {
            id: "plan-2",
            name: "Mita April",
            source: "mita",
            items: [],
            createdAt: "2026-04-17T03:00:00.000Z",
            status: "draft",
          },
        ],
      }),
    );

    renderWithProviders(<ProductionPlanDetailPage planId="plan-2" />);

    await user.click(await screen.findByRole("button", { name: /Add Item/i }));
    expect(screen.getByPlaceholderText(/Search product or SKU/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Close item picker/i }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/Search product or SKU/i)).not.toBeInTheDocument(),
    );
  });
});
