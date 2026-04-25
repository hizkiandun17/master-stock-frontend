import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { OverviewPage } from "@/components/master-stock/overview-page";
import { AppProviders } from "@/components/providers/app-providers";

function renderOverview() {
  window.localStorage.clear();
  return render(
    <AppProviders>
      <OverviewPage />
    </AppProviders>,
  );
}

function setViewportWidth(width: number) {
  act(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  });
}

describe("OverviewPage", () => {
  it("renders the stocks table with actual-only controls", () => {
    renderOverview();

    expect(screen.getByRole("heading", { name: /Stocks/i })).toBeInTheDocument();
    expect(screen.getByText(/Total SKU/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Units/i)).toBeInTheDocument();
    expect(screen.getByText(/Out of Stock/i)).toBeInTheDocument();
    expect(screen.getByText(/Low Stock/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Archived/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Open export options/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open add stock options/i })).toBeInTheDocument();
  });

  it("shows only global stock exports in the top export menu", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole("button", { name: /Open export options/i }));

    expect(screen.getByRole("button", { name: /Stock Summary/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Production Team Report/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Production Plan/i }),
    ).not.toBeInTheDocument();
  });

  it("filters the table when a summary card is clicked", async () => {
    const user = userEvent.setup();
    renderOverview();

    expect(
      screen.getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Out of Stock/i }));

    expect(
      screen.queryByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/BABE Bracelet \| Silver \| Valentine's Day Edition/i),
    ).toBeInTheDocument();
  });

  it("keeps informational cards non-interactive while filter cards stay actionable", () => {
    renderOverview();

    expect(
      screen.queryByRole("button", { name: /Total SKU/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Total Units/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Out of Stock/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Low Stock/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Archived/i }).length).toBeGreaterThan(0);
  });

  it("resets the table filter when the active summary card is clicked again", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole("button", { name: /Out of Stock/i }));

    expect(
      screen.queryByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Out of Stock/i }));

    expect(
      screen.getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i),
    ).toBeInTheDocument();
  });

  it("opens product detail modal when a row is clicked", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(
      screen.getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i),
    );

    expect(
      screen.getByRole("heading", {
        name: /4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/SKU: VAL-GEM-4ER-G/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan QR Code/i)).toBeInTheDocument();
    expect(screen.getByText(/Consignment Price \(IDR\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Close dialog/i }));

    expect(
      screen.queryByRole("heading", {
        name: /4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows stock condition styling inside the product detail modal", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.type(screen.getByPlaceholderText(/Search by name or SKU/i), "Adventurous");
    await user.click(screen.getByText(/Adventurous Bracelet \| Gold/i));
    expect(screen.getAllByText(/Low Stock/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Close dialog/i }));

    await user.clear(screen.getByPlaceholderText(/Search by name or SKU/i));
    await user.type(screen.getByPlaceholderText(/Search by name or SKU/i), "Accepting Choker");
    await user.click(screen.getByText(/Accepting Choker \| Silver/i));
    expect(screen.getAllByText(/Out of Stock/i).length).toBeGreaterThan(0);
  });

  it("opens the row action dropdown and uses view details from the menu", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(
      screen.getByRole("button", {
        name: /Open actions for 4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    );

    expect(
      screen.getByText(/View Details & QR/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Edit Stock/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete/i)).toBeInTheDocument();

    await user.click(screen.getByText(/View Details & QR/i));

    expect(
      screen.getByRole("heading", {
        name: /4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    ).toBeInTheDocument();
  });

  it("keeps mobile stock cards clean without per-card action buttons", () => {
    setViewportWidth(480);
    renderOverview();

    expect(
      screen.queryByRole("button", {
        name: /Open actions for 4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    ).not.toBeInTheDocument();

    setViewportWidth(1024);
  });

  it("enters mobile selection mode on long press and opens bulk actions", async () => {
    vi.useFakeTimers();

    try {
      setViewportWidth(480);
      renderOverview();

      const card = screen
        .getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i)
        .closest('[role="button"]');

      expect(card).not.toBeNull();

      fireEvent.pointerDown(card!, {
        pointerType: "touch",
        clientX: 10,
        clientY: 10,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      fireEvent.pointerUp(card!, { pointerType: "touch" });

      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Open bulk actions/i }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Open bulk actions/i }));

      expect(screen.getAllByText(/^Actions$/i).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /View Details & QR/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Edit Stock/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Archive Stock/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Delete$/i })).toBeInTheDocument();
    } finally {
      act(() => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
      setViewportWidth(1024);
    }
  });

  it("keeps mobile scroll gestures from toggling selection", () => {
    try {
      setViewportWidth(480);
      renderOverview();

      const card = screen
        .getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i)
        .closest('[role="button"]');

      expect(card).not.toBeNull();

      fireEvent.wheel(card!, { deltaY: 120 });

      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
    } finally {
      setViewportWidth(1024);
    }
  });

  it("clears mobile selection UI after archive so the list remains interactive", () => {
    vi.useFakeTimers();

    try {
      setViewportWidth(480);
      renderOverview();

      const card = screen
        .getByText(/4EVER Bracelet \| Gold \| Valentine's Day Edition/i)
        .closest('[role="button"]');

      expect(card).not.toBeNull();

      fireEvent.pointerDown(card!, {
        pointerType: "touch",
        clientX: 10,
        clientY: 10,
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      fireEvent.pointerUp(card!, { pointerType: "touch" });
      fireEvent.click(screen.getByRole("button", { name: /Open bulk actions/i }));
      fireEvent.click(screen.getByRole("button", { name: /Archive Stock/i }));

      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Close bulk actions/i)).not.toBeInTheDocument();

      const nextCard = screen
        .getByText(/4EVER Bracelet \| Silver \| Valentine's Day Edition/i)
        .closest('[role="button"]');

      expect(nextCard).not.toBeNull();
      fireEvent.click(nextCard!);
      expect(
        screen.getByRole("heading", {
          name: /4EVER Bracelet \| Silver \| Valentine's Day Edition/i,
        }),
      ).toBeInTheDocument();
    } finally {
      act(() => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
      setViewportWidth(1024);
    }
  });

  it("opens edit stock prices modal from the row action dropdown", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(
      screen.getByRole("button", {
        name: /Open actions for 4EVER Bracelet \| Gold \| Valentine's Day Edition/i,
      }),
    );
    await user.click(screen.getByText(/^Edit Stock$/i));

    expect(
      screen.getByRole("heading", { name: /Edit Stock Prices/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Wholesale Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Consignment Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Consignment Price \(IDR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Wholesale Price \(EUR\)/i)).toBeInTheDocument();
    expect(screen.getByTestId("dialog-overlay").parentElement).toBe(document.body);
  });

  it("opens create stock item modal from the top action button", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole("button", { name: /Open add stock options/i }));
    await user.click(screen.getByRole("button", { name: /Add New Stock/i }));

    expect(
      screen.getByRole("heading", { name: /Create New Stock Item/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Enter the details for the new stock item\. Inventory counts start at zero\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Product Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Retail Price \(IDR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Wholesale Price \(EUR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Category \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Can.?t find category\?/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Manage categories →/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Stock Item/i })).toBeDisabled();
    expect(screen.getByTestId("dialog-overlay").parentElement).toBe(document.body);

    await user.click(screen.getByRole("button", { name: /Manage categories →/i }));

    expect(
      screen.getByRole("heading", { name: /Manage Categories/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Organize and manage your product collections/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add New Category/i }),
    ).toBeInTheDocument();
  });

  it("opens manage categories directly from the add stock dropdown", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole("button", { name: /Open add stock options/i }));
    await user.click(screen.getByRole("button", { name: /Manage Categories/i }));

    expect(
      screen.getByRole("heading", { name: /Manage Categories/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Organize and manage your product collections/i),
    ).toBeInTheDocument();
  });

  it("creates a new category inline from the stock modal and auto-selects it", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole("button", { name: /Open add stock options/i }));
    await user.click(screen.getByRole("button", { name: /Add New Stock/i }));
    await user.click(screen.getByRole("button", { name: /Select category/i }));
    await user.click(screen.getByRole("button", { name: /Create new category/i }));
    await user.type(screen.getByPlaceholderText(/Enter category name/i), "Custom Drop Test");
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    expect(
      screen.getByRole("button", { name: /CUSTOM DROP TEST/i }),
    ).toBeInTheDocument();
  });

  it("adds and renames categories inside the manage categories dialog", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole("button", { name: /Open add stock options/i }));
    await user.click(screen.getByRole("button", { name: /Add New Stock/i }));
    await user.click(screen.getByRole("button", { name: /Manage categories →/i }));
    await user.click(screen.getByRole("button", { name: /Add New Category/i }));
    await user.type(screen.getByPlaceholderText(/Enter category name/i), "Aurora Capsule");
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    expect(
      screen.getByRole("button", { name: /Open actions for AURORA CAPSULE/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Open actions for AURORA CAPSULE/i }),
    );
    await user.click(screen.getByRole("button", { name: /Rename/i }));
    const renameInput = screen.getByDisplayValue(/AURORA CAPSULE/i);
    await user.clear(renameInput);
    await user.type(renameInput, "Aurora Limited");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    expect(
      screen.getByRole("button", { name: /Open actions for AURORA LIMITED/i }),
    ).toBeInTheDocument();
  });
});
