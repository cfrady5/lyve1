'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';

interface PhotoWithData {
  file: File;
  preview: string;
  name: string;
  costBasis: number;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
}

interface RapidPhotoUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (items: Array<{
    name: string;
    costBasis: number;
    imageUrl?: string;
    file: File;
  }>) => Promise<void>;
}

export function RapidPhotoUpload({ open, onOpenChange, onUpload }: RapidPhotoUploadProps) {
  const [photos, setPhotos] = useState<PhotoWithData[]>([]);
  const [defaultCost, setDefaultCost] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const newPhotos: PhotoWithData[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      costBasis: defaultCost
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleApplyDefaultCost = () => {
    if (defaultCost <= 0) {
      alert('Please enter a valid cost');
      return;
    }
    setPhotos(prev => prev.map(p => ({ ...p, costBasis: defaultCost })));
  };

  const updatePhotoCost = (index: number, cost: number) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, costBasis: cost } : p));
  };

  const updatePhotoName = (index: number, name: string) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, name } : p));
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  };

  const handleUpload = async () => {
    const invalidPhotos = photos.filter(p => !p.name || p.costBasis <= 0);
    if (invalidPhotos.length > 0) {
      alert(`${invalidPhotos.length} items are missing name or cost. Please fill in all fields.`);
      return;
    }

    setUploading(true);
    try {
      await onUpload(photos.map(p => ({
        name: p.name,
        costBasis: p.costBasis,
        file: p.file
      })));

      // Cleanup
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setDefaultCost(0);
      onOpenChange(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload items');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    photos.forEach(p => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setDefaultCost(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !uploading && (open ? onOpenChange(open) : handleCancel())}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Rapid Photo Upload</DialogTitle>
          <DialogDescription>
            Upload multiple item photos and assign costs. Items will be numbered automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {photos.length > 0 ? 'Add More Photos' : 'Select Photos'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Bulk Cost Actions */}
          {photos.length > 0 && (
            <div className="flex gap-2 items-end p-4 bg-muted rounded-lg">
              <div className="flex-1 space-y-1">
                <Label htmlFor="default_cost" className="text-sm">
                  Default Cost (apply to all)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="default_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={defaultCost || ''}
                    onChange={(e) => setDefaultCost(parseFloat(e.target.value) || 0)}
                    className="pl-6"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <Button onClick={handleApplyDefaultCost} variant="secondary">
                Apply to All
              </Button>
            </div>
          )}

          {/* Photo Grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="relative aspect-square bg-muted rounded overflow-hidden">
                    <Image
                      src={photo.preview}
                      alt={photo.name}
                      fill
                      className="object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removePhoto(index)}
                      disabled={uploading}
                    >
                      ×
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Input
                      value={photo.name}
                      onChange={(e) => updatePhotoName(index, e.target.value)}
                      placeholder="Item name"
                      disabled={uploading}
                      className="text-sm"
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={photo.costBasis || ''}
                        onChange={(e) => updatePhotoCost(index, parseFloat(e.target.value) || 0)}
                        disabled={uploading}
                        className="pl-5 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  {photo.error && (
                    <p className="text-xs text-red-600">{photo.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {photos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No photos selected</p>
              <p className="text-sm mt-1">Click &quot;Select Photos&quot; to get started</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {photos.length > 0 && `${photos.length} item${photos.length === 1 ? '' : 's'} ready to upload`}
          </div>
          <Button variant="outline" onClick={handleCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={photos.length === 0 || uploading}>
            {uploading ? 'Uploading...' : `Add ${photos.length} Item${photos.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
