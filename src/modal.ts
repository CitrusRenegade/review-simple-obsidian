import { App, Modal, TFile } from "obsidian";

export class ConfirmReviewModal extends Modal {
  private file: TFile;
  private onConfirm: () => void;

  constructor(app: App, file: TFile, onConfirm: () => void) {
    super(app);
    this.file = file;
    this.onConfirm = onConfirm;
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
    confirmBtn.addEventListener("click", () => {
      this.onConfirm();
      this.close();
    });

    const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
