import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { BatchDetailPage } from "@/components/master-stock/batch-detail-page";
import { BatchesPage } from "@/components/master-stock/batches-page";
import { CreateBatchPage } from "@/components/master-stock/create-batch-page";
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

describe("Production Batch", () => {
  it("renders the production batch list and opens a batch card", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    pushMock.mockReset();

    renderWithProviders(<BatchesPage />);

    expect(screen.getByRole("heading", { name: /^Production Batch$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Production Batch/i })).toBeInTheDocument();
    expect(screen.getByText(/Indira Ramadan Return/i)).toBeInTheDocument();
    expect(screen.getByText(/Warehouse Mixed Return/i)).toBeInTheDocument();
    expect(screen.getByText(/Created 13 Apr 2026/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Indira Ramadan Return/i));

    expect(pushMock).toHaveBeenCalledWith("/master-stock/incoming/incoming-1");
  });

  it("creates a production batch from the dedicated create page", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    pushMock.mockReset();

    renderWithProviders(<CreateBatchPage />);

    await user.type(screen.getByRole("textbox", { name: /Batch Name/i }), "Friday Return");
    await user.selectOptions(screen.getByRole("combobox", { name: /Source/i }), "mita");
    await user.click(screen.getByRole("button", { name: /Add Item/i }));
    await user.type(screen.getByPlaceholderText(/Search product or SKU/i), "4EVER");
    await user.keyboard("{Enter}");

    const quantityInput = await screen.findByDisplayValue("0");
    await waitFor(() => expect(quantityInput).toHaveFocus());
    await user.clear(quantityInput);
    await user.type(quantityInput, "12");

    await user.click(screen.getAllByRole("button", { name: /^Create Production Batch$/i })[0]);

    expect(pushMock).toHaveBeenCalled();

    await waitFor(() => {
      const persistedState = JSON.parse(
        window.localStorage.getItem("master-stock-state-v2") ?? "{}",
      ) as {
        batches?: Array<{
          name?: string;
          status: string;
          items: Array<{ quantity: number }>;
        }>;
      };

      const createdIncoming = persistedState.batches?.find((entry) => entry.name === "Friday Return");
      expect(createdIncoming?.status).toBe("draft");
      expect(createdIncoming?.items[0]).toMatchObject({ quantity: 12 });
    });
  });

  it("moves a production batch from summary into receiving and then completes it", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "owner",
        batches: [
          {
            id: "incoming-10",
            name: "Owner Visibility Incoming",
            source: "indira",
            status: "submitted",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
            submittedAt: "2026-04-17T05:00:00.000Z",
            createdBy: "owner",
            items: [
              {
                id: "incoming-item-10",
                productId: "prd-1",
                quantity: 10,
              },
            ],
            history: [],
          },
        ],
      }),
    );

    renderWithProviders(<BatchDetailPage batchId="incoming-10" />);

    expect(
      await screen.findByRole("heading", { name: /Owner Visibility Incoming/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Submission summary/i)).toBeInTheDocument();
    expect(screen.queryByText(/Receiving checklist/i)).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^Receive$/i })[0]);
    await waitFor(() =>
      expect(
        screen.getByText(/Receiving checklist/i),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /Check 4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Update & Complete/i }).length,
      ).toBeGreaterThan(0),
    );

    await user.click(screen.getAllByRole("button", { name: /Update & Complete/i })[0]);
    expect(
      screen.getByText(/This will update stock in bulk from the checked receiving list/i),
    ).toBeInTheDocument();
    const completeButtons = screen.getAllByRole("button", { name: /^Update & Complete$/i });
    await user.click(completeButtons[completeButtons.length - 1]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Completed summary/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /Show Activity/i }));
    expect(screen.getByText(/Completed production batch/i)).toBeInTheDocument();

    await waitFor(() => {
      const persistedState = JSON.parse(
        window.localStorage.getItem("master-stock-state-v2") ?? "{}",
      ) as {
        products?: Array<{ id: string; currentStock: { indira: number } }>;
        batches?: Array<{ id: string; status: string; completedAt?: string }>;
      };

      const updatedProduct = persistedState.products?.find((product) => product.id === "prd-1");
      const updatedIncoming = persistedState.batches?.find((entry) => entry.id === "incoming-10");

      expect(updatedProduct?.currentStock.indira).toBe(12);
      expect(updatedIncoming?.status).toBe("completed");
      expect(updatedIncoming?.completedAt).toBeTruthy();
    });
  });

  it("blocks production users from the internal production batch detail", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "production",
        batches: [
          {
            id: "incoming-11",
            name: "Craftsman Return",
            source: "mita",
            status: "draft",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
            createdBy: "production",
            items: [],
            history: [],
          },
        ],
      }),
    );

    renderWithProviders(<BatchDetailPage batchId="incoming-11" />);

    expect(await screen.findByText(/Production Batch is internal-only/i)).toBeInTheDocument();
  });
});
