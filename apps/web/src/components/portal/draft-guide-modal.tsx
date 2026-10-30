import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgeArticle } from "@lib/knowledge-base";
import { ChangeEvent, FormEvent, useState } from "react";

export interface Article {
  id?: string;
  title: string;
  department: "TECHNICAL_SUPPORT" | "GENERAL";
  category: string;
  tags?: string[];
  summary: string;
  body: string;
  steps?: string[];
  keywords?: string[];
}

interface DraftGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingArticle?: KnowledgeArticle | null;
  isAdmin?: boolean;
  onSuccess?: () => void;
}

export function DraftGuideModal({
  isOpen,
  onClose,
  editingArticle,
  isAdmin = false,
  onSuccess,
}: DraftGuideModalProps) {
  // Form State
  const [title, setTitle] = React.useState("");
  const [department, setDepartment] = useState<"TECHNICAL_SUPPORT" | "GENERAL">(
    "TECHNICAL_SUPPORT",
  );
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [bodyMode, setBodyMode] = useState<"write" | "preview">("write");
  const [steps, setSteps] = useState<string[]>([""]);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever editingArticle opens or changes
  React.useEffect(() => {
    if (editingArticle) {
      setTitle(editingArticle.title ?? "");
      setDepartment(editingArticle.department ?? "TECHNICAL_SUPPORT");
      setCategory(editingArticle.category ?? "");
      setTagsInput(editingArticle.tags?.join(", ") ?? "");
      setSummary(editingArticle.summary ?? "");
      setBody(editingArticle.body ?? "");
      setSteps(editingArticle.steps?.length ? editingArticle.steps : [""]);
      setKeywordsInput(editingArticle.keywords?.join(", ") ?? "");
    } else {
      // Reset form for fresh draft
      setTitle("");
      setDepartment("TECHNICAL_SUPPORT");
      setCategory("");
      setTagsInput("");
      setSummary("");
      setBody("");
      setSteps([""]);
      setKeywordsInput("");
    }
  }, [editingArticle, isOpen]);

  // Dynamic Step handlers
  const addStep = () => setSteps((prev) => [...prev, ""]);
  const handleStepChange = (index: number, val: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? val : s)));
  };
  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Call your API / mutation here (e.g. trpc, react-query, or fetch)
      // await saveGuideMutation({ title, department, ... })
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to save draft:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay onClick={onClose} />
      <ModalContent className="max-w-4xl border-2 border-spruce-600 dark:border-spruce-400 bg-white dark:bg-spruce-950 shadow-2xl">
        <ModalHeader className="border-b border-spruce-200 dark:border-spruce-800 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <ModalTitle className="text-base sm:text-lg font-bold text-spruce-950 dark:text-white">
                {editingArticle
                  ? `Edit Guide: "${editingArticle.title}"`
                  : "Draft New Knowledge Base Guide"}
              </ModalTitle>
              <ModalDescription className="text-xs text-spruce-600 dark:text-spruce-400">
                {isAdmin
                  ? "Staff drafts can be published immediately by Administrators."
                  : "Guides created by Support Agents are saved as drafts for Administrator review."}
              </ModalDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white"
            >
              ✕ Close
            </Button>
          </div>
        </ModalHeader>

        <form
          onSubmit={handleSave}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <ModalBody className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            {/* Row 1: Title & Department */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold">Title *</Label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. VPN Tunnel Handshake Failure"
                  value={title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setTitle(e.target.value)
                  }
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Scope / Department *
                </Label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as any)}
                  className="w-full h-9 px-2.5 rounded-lg text-xs border border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-900 text-spruce-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-spruce-500"
                >
                  <option value="TECHNICAL_SUPPORT">Technical Support</option>
                  <option value="GENERAL">General Scope</option>
                </select>
              </div>
            </div>

            {/* Row 2: Category & Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Category</Label>
                <Input
                  type="text"
                  placeholder="e.g. Network & Connectivity"
                  value={category}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setCategory(e.target.value)
                  }
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Tags (comma-separated)
                </Label>
                <Input
                  type="text"
                  placeholder="VPN, Network, Gateway, DNS"
                  value={tagsInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setTagsInput(e.target.value)
                  }
                  className="text-xs"
                />
              </div>
            </div>

            {/* Row 3: Deflection Summary */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Deflection Summary *</Label>
              <Textarea
                rows={2}
                required
                placeholder="Concise overview of what this troubleshooting guide resolves..."
                value={summary}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setSummary(e.target.value)
                }
                className="text-xs"
              />
            </div>

            {/* Row 4: Markdown Body */}
            <div className="space-y-2 border border-spruce-200 dark:border-spruce-800 rounded-lg p-3 bg-spruce-50/50 dark:bg-spruce-900/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Full Markdown Body</Label>
                <div className="flex items-center gap-1 bg-white dark:bg-spruce-800 p-0.5 rounded border border-spruce-300 dark:border-spruce-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setBodyMode("write")}
                    className={`px-2 py-0.5 rounded ${
                      bodyMode === "write"
                        ? "bg-spruce-800 text-white dark:bg-spruce-200 dark:text-spruce-950 font-semibold"
                        : "text-spruce-600 dark:text-spruce-400"
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodyMode("preview")}
                    className={`px-2 py-0.5 rounded ${
                      bodyMode === "preview"
                        ? "bg-spruce-800 text-white dark:bg-spruce-200 dark:text-spruce-950 font-semibold"
                        : "text-spruce-600 dark:text-spruce-400"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {bodyMode === "write" ? (
                <Textarea
                  rows={6}
                  placeholder="Write detailed documentation in Markdown..."
                  value={body}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setBody(e.target.value)
                  }
                  className="text-xs font-mono"
                />
              ) : (
                <div className="p-3 bg-white dark:bg-spruce-950 rounded border border-spruce-200 dark:border-spruce-800 min-h-35 text-xs prose prose-sm dark:prose-invert max-w-none">
                  {body.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {body}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-spruce-400 italic">
                      No markdown content written yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Row 5: Dynamic Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">
                  Step-by-Step Resolution Steps
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStep}
                  className="h-7 text-xs"
                >
                  + Add Step
                </Button>
              </div>
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-spruce-200 dark:bg-spruce-800 text-spruce-900 dark:text-spruce-100 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <Input
                      type="text"
                      placeholder={`Step ${idx + 1} action...`}
                      value={step}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleStepChange(idx, e.target.value)
                      }
                      className="text-xs flex-1"
                    />
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-red-500 hover:text-red-700 text-xs px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Row 6: Keywords */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Deflection Keywords</Label>
              <Input
                type="text"
                placeholder="vpn, gateway, handshake, disconnect, tunnel"
                value={keywordsInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setKeywordsInput(e.target.value)
                }
                className="text-xs"
              />
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-end gap-2 border-t border-spruce-200 dark:border-spruce-800 bg-spruce-50/50 dark:bg-spruce-950">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 text-xs font-bold bg-spruce-800 text-white hover:bg-spruce-900 dark:bg-spruce-100 dark:text-spruce-950 dark:hover:bg-white"
            >
              {isSubmitting
                ? "Saving..."
                : editingArticle
                  ? "Update Guide"
                  : "Save Draft"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
