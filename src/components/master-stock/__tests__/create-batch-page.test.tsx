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
  it("creates a production batch from the dedicated create page", async () => {
    const user = userEvent.setup();
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
});
