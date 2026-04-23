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
    expect(screen.queryByRole("button", { name: /Create Production Batch/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Indira Ramadan Return/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Mita Valentine Return/i)).toBeInTheDocument();
    expect(screen.getByText(/Warehouse Mixed Return/i)).toBeInTheDocument();
    expect(screen.getByText(/Created 12 Apr 2026/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Mita Valentine Return/i));

    expect(pushMock).toHaveBeenCalledWith("/master-stock/incoming/incoming-2");
  });

  it("shows draft creation only for production users", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "production",
      }),
    );
    pushMock.mockReset();

    renderWithProviders(<BatchesPage />);

    expect(screen.getByRole("button", { name: /New Batch/i })).toBeInTheDocument();
    expect(screen.getByText(/Indira Ramadan Return/i)).toBeInTheDocument();
    expect(screen.getByText(/In Review/i)).toBeInTheDocument();
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

  it("keeps submitted item preview collapsed until users expand it", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "owner",
        batches: [
          {
            id: "incoming-preview",
            name: "Preview Incoming",
            source: "indira",
            status: "submitted",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
            submittedAt: "2026-04-17T05:00:00.000Z",
            createdBy: "owner",
            items: [
              { id: "preview-1", productId: "prd-1", quantity: 10 },
              { id: "preview-2", productId: "prd-2", quantity: 8 },
              { id: "preview-3", productId: "prd-3", quantity: 7 },
              { id: "preview-4", productId: "prd-4", quantity: 6 },
              { id: "preview-5", productId: "prd-5", quantity: 5 },
              { id: "preview-6", productId: "prd-6", quantity: 4 },
              { id: "preview-7", productId: "prd-7", quantity: 3 },
              { id: "preview-8", productId: "prd-8", quantity: 2 },
            ],
            history: [],
          },
        ],
      }),
    );

    renderWithProviders(<BatchDetailPage batchId="incoming-preview" />);

    expect(screen.queryByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i)).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Preview 8 Items/i }));

    expect(screen.getByRole("dialog", { name: /Submitted Items/i })).toBeInTheDocument();
    expect(screen.getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i)).toBeVisible();
    expect(screen.getByText(/Laylat al-Qadr Bracelet \| Gold \| Ramadhan Edition/i)).toBeVisible();
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

  it("opens a mobile quick-add sheet for production draft input", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "production",
        batches: [
          {
            id: "incoming-quick-add",
            name: "Quick Add Return",
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

    renderWithProviders(<BatchDetailPage batchId="incoming-quick-add" />);

    await user.click(await screen.findByRole("button", { name: /^Add item$/i }));

    const quickSearch = screen.getByPlaceholderText(/Search product or SKU/i);
    await waitFor(() => expect(quickSearch).toHaveFocus());

    await user.type(quickSearch, "Noor");
    await user.click(await screen.findByRole("button", { name: /Noor Iftar Bracelet/i }));

    const quantityInput = (await screen.findAllByLabelText(/Quantity for Noor Iftar Bracelet/i))[0];
    await waitFor(() => expect(quantityInput).toHaveFocus());
    expect(screen.getByPlaceholderText(/Search product or SKU/i)).toBeInTheDocument();
  });

  it("lets production users cancel a submitted batch before internal receiving", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "production",
        batches: [
          {
            id: "incoming-12",
            name: "Submitted Craftsman Return",
            source: "mita",
            status: "submitted",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
            submittedAt: "2026-04-17T04:00:00.000Z",
            createdBy: "production",
            items: [
              {
                id: "incoming-item-12",
                productId: "prd-1",
                quantity: 4,
              },
            ],
            history: [],
          },
        ],
      }),
    );

    renderWithProviders(<BatchDetailPage batchId="incoming-12" />);

    expect(await screen.findByText(/Submitted summary/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search or add item/i)).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Cancel Submission/i })[0]);

    await waitFor(() => {
      const persistedState = JSON.parse(
        window.localStorage.getItem("master-stock-state-v2") ?? "{}",
      ) as {
        batches?: Array<{ id: string; status: string; submittedAt?: string }>;
      };

      const updatedIncoming = persistedState.batches?.find((entry) => entry.id === "incoming-12");
      expect(updatedIncoming?.status).toBe("draft");
      expect(updatedIncoming?.submittedAt).toBeUndefined();
    });
  });
});
