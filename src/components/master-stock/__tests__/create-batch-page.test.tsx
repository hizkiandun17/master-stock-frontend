import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CreateBatchPage } from "@/components/master-stock/create-batch-page";
import { AppProviders } from "@/components/providers/app-providers";
import { defaultCategories, defaultProducts } from "@/lib/mock-data";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function renderWithProviders(element: React.ReactElement) {
  return render(<AppProviders>{element}</AppProviders>);
}

describe("CreateBatchPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "master-stock-state-v2",
      JSON.stringify({
        currentUserRole: "owner",
        products: defaultProducts,
        categories: defaultCategories,
        batches: [],
      }),
    );
    pushMock.mockReset();
  });

  it("creates a production batch from the dedicated create page", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateBatchPage />);

    await user.type(screen.getByRole("textbox", { name: /Batch Name/i }), "Friday Return");
    await user.type(screen.getByPlaceholderText(/Search or add item/i), "4EVER");

    const searchResult = await screen.findByRole("button", {
      name: /4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
    });
    await user.click(searchResult);

    const quantityInput = await screen.findByLabelText(
      /Quantity for 4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
    );
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

  it("shows a mobile floating add button on the create batch page", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateBatchPage />);

    await user.click(screen.getByRole("button", { name: /^Add item$/i }));

    const quickSearch = screen.getByPlaceholderText(/Search product or SKU/i);
    await waitFor(() => expect(quickSearch).toHaveFocus());

    await user.type(quickSearch, "Aquamarine from Brazil");
    await user.click(
      await screen.findByRole("button", {
        name: /Aquamarine from Brazil Bracelet \| Gold/i,
      }),
    );

    const quantityInput = await screen.findByLabelText(
      /Quantity for Aquamarine from Brazil Bracelet \| Gold/i,
    );
    await waitFor(() => expect(quantityInput).toHaveFocus());
    await user.clear(quantityInput);
    await user.type(quantityInput, "18");
    expect(screen.queryByPlaceholderText(/Search product or SKU/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Add item$/i }));
    await user.type(screen.getByPlaceholderText(/Search product or SKU/i), "Aquamarine from Brazil");
    await user.click(
      await screen.findByRole("button", {
        name: /Aquamarine from Brazil Bracelet \| Gold/i,
      }),
    );
    expect(screen.getAllByLabelText(/Quantity for Aquamarine from Brazil Bracelet \| Gold/i)).toHaveLength(1);
    expect(screen.queryByPlaceholderText(/Search product or SKU/i)).not.toBeInTheDocument();
  });
});
