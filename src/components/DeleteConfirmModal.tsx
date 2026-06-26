import { Modal } from "./Modal";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  title = "Confirm Deletion",
  description = "This action is permanent and cannot be undone. Consider stopping the bot instead of deleting it."
}: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-center text-muted-foreground">{description}</p>
        <div className="flex gap-3 w-full mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {loading ? "Deleting..." : "Confirm Delete"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
