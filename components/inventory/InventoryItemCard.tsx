import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { CostBasisEditor } from "./CostBasisEditor";

interface InventoryItem {
  id: string;
  card_number: number;
  cost_basis: number;
  image_url: string | null;
  purchase_price?: number;
  purchase_tax?: number;
  shipping_in?: number;
  supplies_cost?: number;
  grading_cost?: number;
  other_costs?: number;
  sale_items?: {
    item_title: string;
    sale_price: number;
    fees: number;
    platform_key?: string | null;
    platforms?: {
      display_name: string;
      fee_percent_default: number;
    } | null;
  } | null;
}

interface InventoryItemCardProps {
  item: InventoryItem;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showCheckbox?: boolean;
  itemLabelPattern?: string;
  onRefresh?: () => void;
}

export function InventoryItemCard({
  item,
  isSelected = false,
  onToggleSelect,
  showCheckbox = false,
  itemLabelPattern = 'Card #',
  onRefresh
}: InventoryItemCardProps) {
  const isSold = !!item.sale_items;
  const profit = isSold
    ? item.sale_items!.sale_price - item.sale_items!.fees - item.cost_basis
    : null;

  const roi = isSold && item.cost_basis > 0
    ? ((profit! / item.cost_basis) * 100)
    : null;

  const margin = isSold && item.sale_items!.sale_price > 0
    ? ((profit! / item.sale_items!.sale_price) * 100)
    : null;

  // Generate the item label using the detected pattern
  const itemLabel = `${itemLabelPattern}${item.card_number}`;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isSold ? "border-success-subtle" : "border-border"
      )}
    >
      {/* Header with integrated checkbox */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {showCheckbox && onToggleSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${itemLabel}`}
            className="mt-0.5"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-base leading-none">
              {itemLabel}
            </h3>
            {isSold ? (
              <Badge variant="default" className="bg-green-600 text-xs px-2 py-0.5">
                Sold
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                Held
              </Badge>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4 pt-0 space-y-3">
        {/* Image */}
        {item.image_url && (
          <div className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            <Image
              src={item.image_url}
              alt={itemLabel}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Financial data */}
        <div className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Cost
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium tabular-nums">
                ${item.cost_basis.toFixed(2)}
              </span>
              <CostBasisEditor
                itemId={item.id}
                currentCostBasis={item.cost_basis}
                currentCostStack={{
                  purchase_price: item.purchase_price,
                  purchase_tax: item.purchase_tax,
                  shipping_in: item.shipping_in,
                  supplies_cost: item.supplies_cost,
                  grading_cost: item.grading_cost,
                  other_costs: item.other_costs,
                }}
                onUpdate={onRefresh}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Edit
                  </Button>
                }
              />
            </div>
          </div>

          {isSold && (
            <>
              {/* Platform badge if available */}
              {item.sale_items!.platforms && (
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs text-muted-foreground">Platform:</span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {item.sale_items!.platforms.display_name}
                  </Badge>
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Sale
                </span>
                <span className="font-mono font-medium tabular-nums">
                  ${item.sale_items!.sale_price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Fees
                </span>
                <span className="font-mono text-muted-foreground tabular-nums">
                  ${item.sale_items!.fees.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-2 mt-2 border-t">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Profit
                </span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    profit! >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {profit! >= 0 ? '+' : ''}${profit!.toFixed(2)}
                </span>
              </div>

              {/* ROI and Margin */}
              {roi !== null && margin !== null && (
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <div className="flex-1 flex items-baseline justify-between">
                    <span className="text-muted-foreground">ROI</span>
                    <span className={cn(
                      "font-mono font-medium",
                      roi >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex-1 flex items-baseline justify-between">
                    <span className="text-muted-foreground">Margin</span>
                    <span className={cn(
                      "font-mono font-medium",
                      margin >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {margin.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
