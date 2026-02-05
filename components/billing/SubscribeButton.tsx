'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SubscribeButtonProps {
  isSubscribed: boolean;
}

export function SubscribeButton({ isSubscribed }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned');
        setLoading(false);
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No portal URL returned');
        setLoading(false);
      }
    } catch (error) {
      console.error('Portal error:', error);
      setLoading(false);
    }
  };

  if (isSubscribed) {
    return (
      <Button
        variant="secondary"
        className="w-full"
        onClick={handleManage}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          'Manage Subscription'
        )}
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      onClick={handleSubscribe}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        'Subscribe to lyve premium'
      )}
    </Button>
  );
}
