'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Upload, Calculator } from 'lucide-react';
import type { SessionExpense, ExpenseCategory, PayrollMetadata } from '@/lib/types/sessions';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/types/sessions';

interface ExpensesSectionProps {
  sessionId: string;
  expenses: SessionExpense[];
  onExpensesChange: () => void;
}

export function ExpensesSection({ sessionId, expenses, onExpensesChange }: ExpensesSectionProps) {
  const [includeGrading, setIncludeGrading] = useState(
    expenses.some((e) => e.category === 'grading_auth')
  );
  const [includePayroll, setIncludePayroll] = useState(
    expenses.some((e) => e.category === 'payroll')
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>('logistics_supplies');

  const handleAddExpense = (category: ExpenseCategory) => {
    setSelectedCategory(category);
    setIsAddDialogOpen(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Delete this expense?')) return;

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { error } = await supabase
        .from('session_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) {
        console.error('[EXP_DEL_001] Failed to delete expense:', error);
        alert(`[EXP_DEL_001] Failed to delete expense: ${error.message}`);
        return;
      }

      onExpensesChange();
    } catch (err) {
      console.error('[EXP_DEL_002] Unexpected error deleting expense:', err);
      alert('[EXP_DEL_002] Unexpected error occurred while deleting expense');
    }
  };

  const getCategoryExpenses = (category: ExpenseCategory) => {
    return expenses.filter((e) => e.category === category);
  };

  const getCategoryTotal = (category: ExpenseCategory) => {
    return getCategoryExpenses(category).reduce((sum, e) => sum + e.amount, 0);
  };

  const getGrandTotal = () => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Expenses</h3>
        <p className="text-sm text-muted-foreground">
          Track all session-related costs for accurate breakeven calculations
        </p>
      </div>

      {/* Logistics & Supplies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Logistics & Supplies</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddExpense('logistics_supplies')}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Import CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ExpenseList
            expenses={getCategoryExpenses('logistics_supplies')}
            onDelete={handleDeleteExpense}
          />
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono font-semibold">
              ${getCategoryTotal('logistics_supplies').toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grading & Authentication (Optional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={includeGrading}
                onCheckedChange={setIncludeGrading}
              />
              <CardTitle className="text-base">Grading & Authentication</CardTitle>
            </div>
            {includeGrading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddExpense('grading_auth')}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        {includeGrading && (
          <CardContent>
            <ExpenseList
              expenses={getCategoryExpenses('grading_auth')}
              onDelete={handleDeleteExpense}
            />
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-sm font-medium">Total</span>
              <span className="font-mono font-semibold">
                ${getCategoryTotal('grading_auth').toFixed(2)}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Payroll (Optional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={includePayroll}
                onCheckedChange={setIncludePayroll}
              />
              <CardTitle className="text-base">Payroll</CardTitle>
            </div>
            {includePayroll && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPayrollDialogOpen(true)}
                >
                  <Calculator className="h-3.5 w-3.5 mr-1" />
                  Calculate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddExpense('payroll')}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        {includePayroll && (
          <CardContent>
            <ExpenseList
              expenses={getCategoryExpenses('payroll')}
              onDelete={handleDeleteExpense}
              showMetadata
            />
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-sm font-medium">Total</span>
              <span className="font-mono font-semibold">
                ${getCategoryTotal('payroll').toFixed(2)}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Other Expenses (Promo, Show Fee, Travel, Misc) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Other Expenses</CardTitle>
            <Button variant="outline" size="sm" onClick={() => handleAddExpense('misc')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ExpenseList
            expenses={expenses.filter((e) =>
              ['promo', 'show_fee', 'travel', 'misc'].includes(e.category)
            )}
            onDelete={handleDeleteExpense}
          />
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono font-semibold">
              ${expenses
                .filter((e) => ['promo', 'show_fee', 'travel', 'misc'].includes(e.category))
                .reduce((sum, e) => sum + e.amount, 0)
                .toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grand Total */}
      <Card className="border-2 border-primary">
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total Expenses</span>
            <span className="text-2xl font-mono font-bold">
              ${getGrandTotal().toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      {isAddDialogOpen && (
        <AddExpenseDialog
          sessionId={sessionId}
          category={selectedCategory}
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSave={() => {
            setIsAddDialogOpen(false);
            onExpensesChange();
          }}
        />
      )}

      {/* Payroll Calculator Dialog */}
      {isPayrollDialogOpen && (
        <PayrollCalculatorDialog
          sessionId={sessionId}
          open={isPayrollDialogOpen}
          onOpenChange={setIsPayrollDialogOpen}
          onSave={() => {
            setIsPayrollDialogOpen(false);
            onExpensesChange();
          }}
        />
      )}
    </div>
  );
}

// ================================================================
// EXPENSE LIST
// ================================================================

interface ExpenseListProps {
  expenses: SessionExpense[];
  onDelete: (expenseId: string) => void;
  showMetadata?: boolean;
}

function ExpenseList({ expenses, onDelete, showMetadata }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No expenses added yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex-1">
            <p className="text-sm font-medium">
              {expense.description || EXPENSE_CATEGORY_LABELS[expense.category]}
            </p>
            {showMetadata && expense.metadata && 'breakers' in expense.metadata && (
              <p className="text-xs text-muted-foreground mt-1">
                {(expense.metadata as PayrollMetadata).breakers} breaker(s) × $
                {(expense.metadata as PayrollMetadata).hourly_rate}/hr × {(expense.metadata as PayrollMetadata).hours} hrs
              </p>
            )}
            {expense.notes && (
              <p className="text-xs text-muted-foreground mt-1">{expense.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">${expense.amount.toFixed(2)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(expense.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ================================================================
// ADD EXPENSE DIALOG
// ================================================================

interface AddExpenseDialogProps {
  sessionId: string;
  category: ExpenseCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

function AddExpenseDialog({ sessionId, category, open, onOpenChange, onSave }: AddExpenseDialogProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { error } = await supabase
        .from('session_expenses')
        .insert({
          session_id: sessionId,
          category,
          amount: parseFloat(amount),
          description: description || null,
          notes: notes || null,
        });

      if (error) {
        console.error('[EXP_ADD_001] Failed to save expense:', error);
        alert(`[EXP_ADD_001] Failed to save expense: ${error.message}`);
        return;
      }

      onSave();
    } catch (error) {
      console.error('[EXP_ADD_002] Unexpected error saving expense:', error);
      alert('[EXP_ADD_002] Unexpected error occurred while saving expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            {EXPENSE_CATEGORY_LABELS[category]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Shipping labels"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!amount || loading}>
            {loading ? 'Adding...' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// PAYROLL CALCULATOR DIALOG
// ================================================================

interface PayrollCalculatorDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

function PayrollCalculatorDialog({ sessionId, open, onOpenChange, onSave }: PayrollCalculatorDialogProps) {
  const [breakers, setBreakers] = useState('1');
  const [hourlyRate, setHourlyRate] = useState('15.00');
  const [hours, setHours] = useState('4');
  const [loading, setLoading] = useState(false);

  const calculateTotal = () => {
    const b = parseInt(breakers) || 0;
    const h = parseFloat(hourlyRate) || 0;
    const hrs = parseFloat(hours) || 0;
    return b * h * hrs;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const total = calculateTotal();
      const metadata: PayrollMetadata = {
        breakers: parseInt(breakers),
        hourly_rate: parseFloat(hourlyRate),
        hours: parseFloat(hours),
      };

      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { error } = await supabase
        .from('session_expenses')
        .insert({
          session_id: sessionId,
          category: 'payroll',
          amount: total,
          description: `Payroll for ${breakers} breaker(s)`,
          metadata,
        });

      if (error) {
        console.error('[EXP_PAY_001] Failed to save payroll:', error);
        alert(`[EXP_PAY_001] Failed to save payroll: ${error.message}`);
        return;
      }

      onSave();
    } catch (error) {
      console.error('[EXP_PAY_002] Unexpected error saving payroll:', error);
      alert('[EXP_PAY_002] Unexpected error occurred while saving payroll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calculate Payroll</DialogTitle>
          <DialogDescription>
            Enter breaker count, hourly rate, and hours worked
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakers">Breakers</Label>
              <Input
                id="breakers"
                type="number"
                value={breakers}
                onChange={(e) => setBreakers(e.target.value)}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Payroll</p>
            <p className="text-2xl font-mono font-bold">
              ${calculateTotal().toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {breakers} × ${hourlyRate} × {hours} hours
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Adding...' : 'Add to Expenses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
