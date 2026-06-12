import { App, Modal, TFile } from "obsidian";

export class ConfirmReviewModal extends Modal {
  private file: TFile;
  private onConfirm: () => void | Promise<void>;
  private confirming = false;

  constructor(app: App, file: TFile, onConfirm: () => void | Promise<void>) {
    super(app);
    this.file = file;
    this.onConfirm = onConfirm;
  }

  private async confirm(
    confirmBtn: HTMLButtonElement,
    cancelBtn: HTMLButtonElement
  ): Promise<void> {
    if (this.confirming) return;

    this.confirming = true;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      await this.onConfirm();
      this.close();
    } catch (e) {
      console.error("Failed to confirm reviewed note:", e);
      this.confirming = false;
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("review-simple-modal");
    contentEl.createEl("h2", { text: "Mark as reviewed?" });
    contentEl.createEl("p", {
      text: `Mark "${this.file.basename}" as reviewed today?`,
    });

    const buttonDiv = contentEl.createDiv({ cls: "modal-button-container" });

    const confirmBtn = buttonDiv.createEl("button", {
      text: "Mark as reviewed",
      cls: "mod-cta",
    });
    const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });

    confirmBtn.addEventListener("click", () => {
      void this.confirm(confirmBtn, cancelBtn);
    });

    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
