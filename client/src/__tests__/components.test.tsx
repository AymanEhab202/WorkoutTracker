import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RestTimer } from '../components/RestTimer';

describe('Frontend UI Components', () => {
  describe('StatCard', () => {
    it('renders title, value, subtitle and trend badge', () => {
      render(
        <StatCard
          title="Weekly Frequency"
          value="4 / 4"
          subtitle="Target reached"
          trend="up"
          trendLabel="100%"
        />
      );

      expect(screen.getByText('Weekly Frequency')).toBeInTheDocument();
      expect(screen.getByText('4 / 4')).toBeInTheDocument();
      expect(screen.getByText('Target reached')).toBeInTheDocument();
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('renders children when open and handles close action', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content inside</p>
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content inside')).toBeInTheDocument();

      // Click close button
      const closeBtn = screen.getByRole('button');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Does not render when isOpen is false
      rerender(
        <Modal isOpen={false} onClose={handleClose} title="Test Modal">
          <p>Modal content inside</p>
        </Modal>
      );
      expect(screen.queryByText('Modal content inside')).not.toBeInTheDocument();
    });
  });

  describe('ConfirmDialog', () => {
    it('triggers confirm and cancel callbacks', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Delete Confirmation"
          message="Are you sure you want to proceed?"
          confirmText="Yes, Delete"
        />
      );

      expect(screen.getByText('Delete Confirmation')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Yes, Delete'));
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Cancel'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('RestTimer', () => {
    it('renders initial timer countdown and responds to controls', () => {
      render(<RestTimer initialSeconds={60} />);

      expect(screen.getByText('Rest Timer')).toBeInTheDocument();
      expect(screen.getAllByText('1:00').length).toBeGreaterThanOrEqual(1);

      // Click start
      const startBtn = screen.getByText('Start');
      fireEvent.click(startBtn);
      expect(screen.getByText('Pause')).toBeInTheDocument();

      // Change preset to 90s
      const preset90 = screen.getByText('90s');
      fireEvent.click(preset90);
      expect(screen.getAllByText('1:30').length).toBeGreaterThanOrEqual(1);
    });
  });
});
