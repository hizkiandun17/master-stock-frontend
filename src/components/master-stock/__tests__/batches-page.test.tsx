import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { BatchDetailPage } from "@/components/master-stock/batch-detail-page";
import { BatchesPage } from "@/components/master-stock/batches-page";
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

  it("shows a simplified draft input flow for production users", async () => {
    const user = userEvent.setup();
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

    expect(await screen.findByRole("heading", { name: /Craftsman Return/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search or add item/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Search or add item/i), "Noor");
    await user.click(await screen.findByText(/Noor Iftar Bracelet/i));

    const quantityInput = (await screen.findAllByLabelText(/Quantity for Noor Iftar Bracelet/i))[0];
    await waitFor(() => expect(quantityInput).toHaveFocus());
  });
});
