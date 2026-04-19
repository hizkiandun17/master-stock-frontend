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

describe("Dispatch", () => {
  it("creates a new draft dispatch record from the dispatch page", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    pushMock.mockReset();
    renderWithProviders(<ProductionPlansPage />);

    expect(screen.getByRole("heading", { name: /^Dispatch$/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Create Dispatch/i })[0]);
    await user.type(screen.getByRole("textbox", { name: /Dispatch Name/i }), "Indira Dispatch");
    await user.selectOptions(screen.getByRole("combobox", { name: /Source/i }), "indira");
    await user.click(screen.getAllByRole("button", { name: /Create Dispatch/i })[1]);

    expect(screen.getByText(/Batch created successfully/i)).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/\/master-stock\/batches\//));
    expect(screen.getByText(/^Indira Dispatch$/i)).toBeInTheDocument();
    expect(screen.getByText(/0 pcs • 0 items/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Created \d{1,2} \w{3} \d{4}/i).length).toBeGreaterThan(0);
  });

  it("moves a dispatch record from draft to completed before export becomes available", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        productionPlans: [
          {
            id: "dispatch-1",
            name: "Indira Dispatch",
            source: "indira",
            notes: "Owner batch",
            items: [],
            createdAt: "2026-04-17T03:00:00.000Z",
            status: "draft",
          },
        ],
      }),
    );

    renderWithProviders(<ProductionPlanDetailPage planId="dispatch-1" />);

    expect(await screen.findByRole("heading", { name: /Indira Dispatch/i })).toBeInTheDocument();
    expect(screen.getByText(/^draft$/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Complete Batch/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Export PDF/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add Item/i }));
    await user.type(screen.getByPlaceholderText(/Search product or SKU/i), "4EVER");
    await user.keyboard("{Enter}");

    const quantityInput = await screen.findByDisplayValue("0");
    await waitFor(() => expect(quantityInput).toHaveFocus());
    await user.clear(quantityInput);
    await user.type(quantityInput, "15");

    await user.click(screen.getAllByRole("button", { name: /Complete Batch/i })[0]);
    expect(screen.getByText(/Mark this batch as complete\?/i)).toBeInTheDocument();
    const completeButtons = screen.getAllByRole("button", { name: /Complete Batch/i });
    await user.click(completeButtons[completeButtons.length - 1]);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Export PDF/i }).length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByRole("button", { name: /^Complete Batch$/i })).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Show Activity/i }));
    expect(screen.getAllByText(/Edited quantity for/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Completed batch/i)).toBeInTheDocument();
  });

  it("blocks direct dispatch access for production users", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "production",
        productionPlans: [
          {
            id: "dispatch-2",
            name: "Mita Dispatch",
            source: "mita",
            items: [],
            createdAt: "2026-04-17T03:00:00.000Z",
            status: "draft",
          },
        ],
      }),
    );

    renderWithProviders(<ProductionPlanDetailPage planId="dispatch-2" />);

    expect(await screen.findByText(/Dispatch is internal-only/i)).toBeInTheDocument();
  });
});
