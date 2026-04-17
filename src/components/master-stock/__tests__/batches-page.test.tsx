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

describe("Batches", () => {
  it("renders the batches list and opens a batch card", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    pushMock.mockReset();

    renderWithProviders(<BatchesPage />);

    expect(screen.getByRole("heading", { name: /^Batches$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Batch/i })).toBeInTheDocument();
    expect(screen.getByText(/Indira Ramadan Intake/i)).toBeInTheDocument();
    expect(screen.getByText(/Created 13 Apr 2026/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Indira Ramadan Intake/i));

    expect(pushMock).toHaveBeenCalledWith("/master-stock/batches/batch-1");
  });

  it("creates a batch from the dedicated create page", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    pushMock.mockReset();

    renderWithProviders(<CreateBatchPage />);

    await user.type(screen.getByRole("textbox", { name: /Batch Name/i }), "Friday Intake");
    await user.selectOptions(screen.getByRole("combobox", { name: /Source/i }), "mita");
    await user.click(screen.getByRole("button", { name: /Add Item/i }));
    await user.type(screen.getByPlaceholderText(/Search product or SKU/i), "4EVER");
    await user.keyboard("{Enter}");

    const plannedInput = await screen.findByDisplayValue("0");
    await waitFor(() => expect(plannedInput).toHaveFocus());
    await user.clear(plannedInput);
    await user.type(plannedInput, "12");
    await waitFor(() => expect(plannedInput).toHaveValue(12));

    await user.click(screen.getAllByRole("button", { name: /^Create Batch$/i })[0]);

    expect(pushMock).toHaveBeenCalled();

    await waitFor(() => {
      const persistedState = JSON.parse(
        window.localStorage.getItem("master-stock-state-v1") ?? "{}",
      ) as {
        batches?: Array<{
          name?: string;
          status: string;
          items: Array<{ plannedQty: number; receivedQty: number; checked: boolean }>;
        }>;
      };

      const createdBatch = persistedState.batches?.find((batch) => batch.name === "Friday Intake");
      expect(createdBatch?.status).toBe("draft");
      expect(createdBatch?.items[0]).toMatchObject({
        plannedQty: 12,
        receivedQty: 12,
        checked: false,
      });
    });
  });

  it("completes a batch and updates source stock from checked items only", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v1",
      JSON.stringify({
        batches: [
          {
            id: "batch-10",
            name: "Owner Visibility Batch",
            source: "indira",
            status: "draft",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
            createdBy: "owner",
            items: [
              {
                id: "line-10",
                productId: "prd-1",
                plannedQty: 10,
                receivedQty: 10,
                checked: false,
              },
            ],
          },
        ],
      }),
    );

    renderWithProviders(<BatchDetailPage batchId="batch-10" />);

    expect(
      await screen.findByRole("heading", { name: /Owner Visibility Batch/i }),
    ).toBeInTheDocument();

    const quantityInput = screen.getByDisplayValue("10");
    await user.click(screen.getByRole("checkbox", { name: /Mark 4EVER Bracelet/i }));
    expect(screen.getByRole("checkbox", { name: /Mark 4EVER Bracelet/i })).toBeChecked();

    await user.clear(quantityInput);
    await user.type(quantityInput, "6");
    await waitFor(() => expect(quantityInput).toHaveValue(6));

    await user.click(screen.getAllByRole("button", { name: /Update Stock & Complete/i })[0]);
    expect(
      screen.getByText(/This will update stock based on the checked items and current quantities/i),
    ).toBeInTheDocument();
    const completeButtons = screen.getAllByRole("button", { name: /Update Stock & Complete/i });
    await user.click(completeButtons[completeButtons.length - 1]);

    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: /Mark 4EVER Bracelet/i })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Updated Indira stock/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Activity History/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Show Activity/i }));
    expect(screen.getByText(/Completed batch/i)).toBeInTheDocument();

    await waitFor(() => {
      const persistedState = JSON.parse(
        window.localStorage.getItem("master-stock-state-v1") ?? "{}",
      ) as {
        products?: Array<{ id: string; currentStock: { indira: number } }>;
        batches?: Array<{ id: string; status: string }>;
      };

      const updatedProduct = persistedState.products?.find((product) => product.id === "prd-1");
      const updatedBatch = persistedState.batches?.find((entry) => entry.id === "batch-10");

      expect(updatedProduct?.currentStock.indira).toBe(8);
      expect(updatedBatch?.status).toBe("completed");
    });
  });

  it("does not update stock for unchecked items when completing a batch", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v1",
      JSON.stringify({
        batches: [
          {
            id: "batch-11",
            name: "Unchecked Batch",
            source: "indira",
            status: "draft",
            createdAt: "2026-04-17T03:00:00.000Z",
            updatedAt: "2026-04-17T03:00:00.000Z",
            createdBy: "owner",
            items: [
              {
                id: "line-11",
                productId: "prd-1",
                plannedQty: 10,
                receivedQty: 10,
                checked: false,
              },
            ],
          },
        ],
      }),
    );

    renderWithProviders(<BatchDetailPage batchId="batch-11" />);

    const quantityInput = await screen.findByDisplayValue("10");
    await user.clear(quantityInput);
    await user.type(quantityInput, "5");

    await user.click(screen.getAllByRole("button", { name: /Update Stock & Complete/i })[0]);
    const completeButtons = screen.getAllByRole("button", { name: /Update Stock & Complete/i });
    await user.click(completeButtons[completeButtons.length - 1]);

    await waitFor(() => {
      const persistedState = JSON.parse(
        window.localStorage.getItem("master-stock-state-v1") ?? "{}",
      ) as {
        products?: Array<{ id: string; currentStock: { indira: number } }>;
      };

      const updatedProduct = persistedState.products?.find((product) => product.id === "prd-1");
      expect(updatedProduct?.currentStock.indira).toBe(2);
    });
  });
});
