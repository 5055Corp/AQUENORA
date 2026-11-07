import { estimatePaymentFee, summarizeSeller, type FinanceOrder } from "../finance"

describe("estimatePaymentFee (Paystack published rates)", () => {
  it("Nigeria: 1.5% + NGN 100, the 100 waived under NGN 2,500, capped at NGN 2,000", () => {
    expect(estimatePaymentFee("NG", 2000)).toBe(30)
    expect(estimatePaymentFee("NG", 10000)).toBe(250)
    expect(estimatePaymentFee("NG", 500000)).toBe(2000)
  })
  it("Nigeria international cards: 3.9% + NGN 100", () => {
    expect(estimatePaymentFee("NG", 10000, true)).toBe(490)
  })
  it("Ghana 1.95%, South Africa 2.9% + R1 plus VAT", () => {
    expect(estimatePaymentFee("GH", 1000)).toBe(19.5)
    expect(estimatePaymentFee("ZA", 100)).toBe(4.49)
  })
  it("no fee on a zero amount", () => {
    expect(estimatePaymentFee("NG", 0)).toBe(0)
  })
})

describe("summarizeSeller", () => {
  const now = new Date("2026-11-07T12:00:00Z")
  const order = (id: string, daysAgo: number, items: FinanceOrder["items"], extra: Partial<FinanceOrder> = {}): FinanceOrder => ({
    id,
    created_at: new Date(now.getTime() - daysAgo * 86400000),
    status: "pending",
    international: false,
    items,
    ...extra,
  })

  it("adds up revenue, costs, fees and profit, skipping cancelled orders and old ones", () => {
    const orders = [
      order("a", 0, [{ product_id: "p1", title: "Kimono", quantity: 2, unit_price: 28000, cost_price: 15000 }]),
      order("b", 3, [{ product_id: "p2", title: "Tote", quantity: 1, unit_price: 10000 }]),
      order("c", 1, [{ product_id: "p1", title: "Kimono", quantity: 5, unit_price: 28000, cost_price: 15000 }], { status: "canceled" }),
      order("d", 20, [{ product_id: "p1", title: "Kimono", quantity: 1, unit_price: 28000, cost_price: 15000 }]),
    ]
    const s = summarizeSeller(orders, "NG", "7d", new Map([["p2", 4000]]), now)

    // a: 56,000 revenue, 30,000 cost, fee 1.5% + 100 = 940, commission 2% = 1,120
    // b: 10,000 revenue, 4,000 cost (current cost price), fee 250, commission 200
    expect(s.totals).toEqual({
      orders: 2,
      items_sold: 3,
      revenue: 66000,
      cost_of_goods: 34000,
      payment_fees: 1190,
      platform_fees: 1320,
      profit: 66000 - 34000 - 1190 - 1320,
      items_missing_cost: 0,
    })
    expect(s.series).toHaveLength(7)
    expect(s.series[6]).toEqual({ date: "2026-11-07", revenue: 56000, profit: 56000 - 30000 - 940 - 1120 })
    expect(s.by_product[0]).toEqual(expect.objectContaining({ title: "Kimono", quantity: 2, revenue: 56000, cost: 30000 }))
    expect(s.fee_basis).toBe("estimate")
  })

  it("counts units with no cost price, and uses a recorded Paystack fee when there is one", () => {
    const s = summarizeSeller(
      [order("a", 0, [{ product_id: "p9", title: "Mystery", quantity: 3, unit_price: 1000 }], { payment_fee: 99 })],
      "NG",
      "all",
      new Map(),
      now
    )
    expect(s.totals.items_missing_cost).toBe(3)
    expect(s.totals.payment_fees).toBe(99)
    expect(s.fee_basis).toBe("actual")
    expect(s.granularity).toBe("month")
    expect(s.series).toEqual([{ date: "2026-11", revenue: 3000, profit: 3000 - 99 - 60 }])
  })
})
