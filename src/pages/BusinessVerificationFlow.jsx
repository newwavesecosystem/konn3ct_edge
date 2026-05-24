import { useEffect, useState } from "react";
import { Building2, ChevronLeft, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  fetchKyc,
  getBankList,
  submitBusinessKyc,
  verifyBank,
} from "../api/donationApi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useToast } from "../hooks/use-toast";

export default function BusinessVerificationFlow({ onComplete }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState("card");
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState(null);
  const [accountName, setAccountName] = useState("");
  const [, setKycStatus] = useState({});
  const [bankSearch, setBankSearch] = useState("");
  
  const [formData, setFormData] = useState({
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    companyAddress: "",
    taxId: "",
    directorFirstName: "",
    directorLastName: "",
    directorEmail: "",
    directorPhone: "",
    directorBvn: "",
    directorIdType: "",
    directorIdFile: null,
    bankAccountNumber: "",
  });

  useEffect(() => {
    getBankList().then(setBanks).catch(console.error);
    fetchKyc().then(setKycStatus).catch(console.error);
  }, []);

  useEffect(() => {
    if (step === "status") {
      fetchKyc().then(setKycStatus).catch(console.error);
    }
  }, [step]);

  useEffect(() => {
    if (formData.bankAccountNumber?.length === 10 && bankCode !== null) {
      verifyBank(formData.bankAccountNumber, bankCode.code)
        .then((res) => {
          if (res.success) setAccountName(res.data.account_name);
          else setAccountName("");
        })
        .catch(() => setAccountName(""));
    }
  }, [formData.bankAccountNumber, bankCode]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const filteredBanks = banks.filter((bank) =>
    bank?.name?.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    try {
      const fd = new FormData();
      fd.append("company_name", formData.companyName);
      fd.append("company_email", formData.companyEmail);
      fd.append("company_phone", formData.companyPhone);
      fd.append("company_address", formData.companyAddress);
      fd.append("company_taxid", formData.taxId);
      fd.append("first_name", formData.directorFirstName);
      fd.append("last_name", formData.directorLastName);
      fd.append("email", formData.directorEmail);
      fd.append("phone", formData.directorPhone);
      fd.append("bvn", formData.directorBvn);
      fd.append("id_type", formData.directorIdType);
      fd.append("id_document", formData.directorIdFile);
      fd.append("bank_code", bankCode?.code || "");
      fd.append("bank_name", bankCode?.name || "");
      fd.append("bank_account_number", formData.bankAccountNumber || "");
      fd.append("bank_account_name", accountName || "");
      fd.append("type", "corporate");

      const res = await submitBusinessKyc(fd);
      if (res.success) onComplete();
      else {
        toast({
          description: res.message || t("donations.business.toasts.kycFailed"),
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        description: t("donations.business.toasts.submitError"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full flex items-center justify-center animate-in fade-in duration-500">
      {step === "card" && (
        <Card className="w-full max-w-[380px] rounded-2xl border-border/60 bg-surface shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-green/10">
              <Building2 className="h-8 w-8 text-brand-green" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {t("donations.business.card.title", "Business Account")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("donations.business.card.description", "Verify your corporate identity to start receiving business donations.")}
            </p>
            
            <div className="w-full mt-6 mb-8 rounded-xl bg-black/[0.02] border border-border/60 p-4 text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Requirements</p>
              <ul className="space-y-2 text-sm font-medium text-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-green"></div>
                  {t("donations.business.card.features.companyInformation", "Registered Company Details")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-green"></div>
                  {t("donations.business.card.features.directorInformation", "Company Director Information")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-green"></div>
                  {t("donations.business.card.features.bankVerification", "Corporate Bank Account")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-green"></div>
                  {t("donations.business.card.features.uploadDirectorId", "Director's Government ID")}
                </li>
              </ul>
            </div>
            <Button 
              className="w-full h-11 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold transition-all" 
              onClick={() => setStep("form")}
            >
              {t("donations.actions.startVerification", "Start Verification")}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "form" && (
        <Card className="w-full max-w-3xl rounded-2xl border-border/60 bg-surface shadow-md overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-black/[0.01] p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10 shrink-0">
                <Building2 className="h-6 w-6 text-brand-green" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-foreground">
                  {t("donations.business.form.title", "Business Verification")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("donations.business.form.description", "Provide your registered company and director details.")}
                </p>
              </div>
            </div>
            <Button variant="outline" className="h-10 rounded-xl hidden sm:flex" onClick={() => setStep("card")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              {t("common.actions.goBack", "Back")}
            </Button>
          </CardHeader>

          <CardContent className="space-y-10 p-6 sm:p-8">
            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2">
                {t("donations.business.sections.companyInformation", "1. Company Information")}
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.business.fields.companyName", "Company Name")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.business.fields.taxId", "Tax Identification Number (TIN)")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.taxId}
                    onChange={(e) => handleChange("taxId", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.business.fields.companyEmail", "Company Email")}</Label>
                  <Input
                    type="email"
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.companyEmail}
                    onChange={(e) => handleChange("companyEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.business.fields.companyPhone", "Company Phone")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.companyPhone}
                    onChange={(e) => handleChange("companyPhone", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.business.fields.companyAddress", "Registered Office Address")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.companyAddress}
                    onChange={(e) => handleChange("companyAddress", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2">
                {t("donations.business.sections.directorInformation", "2. Director Information")}
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("common.forms.firstName", "First Name")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.directorFirstName}
                    onChange={(e) => handleChange("directorFirstName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("common.forms.lastName", "Last Name")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.directorLastName}
                    onChange={(e) => handleChange("directorLastName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("common.forms.email", "Director Email")}</Label>
                  <Input
                    type="email"
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.directorEmail}
                    onChange={(e) => handleChange("directorEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("common.forms.phone", "Director Phone")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.directorPhone}
                    onChange={(e) => handleChange("directorPhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.common.bvn", "Director BVN")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.directorBvn}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t("donations.common.placeholders.enterBvn", "10 digit BVN")}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      handleChange("directorBvn", digits.slice(0, 10));
                    }}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2">
                {t("donations.common.sections.bankDetails", "3. Corporate Bank Details")}
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.common.bank", "Select Bank")}</Label>
                  <Select
                    value={bankCode?.name}
                    onValueChange={(value) => {
                      setBankCode(value);
                      setBankSearch("");
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus:ring-brand-green/30">
                      <SelectValue placeholder={t("donations.common.placeholders.selectBank", "Choose a bank")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <div className="sticky top-0 z-10 bg-surface p-2 border-b border-border/40">
                        <Input
                          className="h-9 rounded-lg"
                          placeholder={t("donations.common.placeholders.searchBank", "Search bank name...")}
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                        />
                      </div>
                      <div className="grid max-h-[250px] grid-cols-1 gap-1 overflow-y-auto p-1.5 md:grid-cols-2">
                        {filteredBanks.length > 0 ? (
                          filteredBanks.map((bank) => (
                            <SelectItem key={bank.code} value={bank} className="rounded-lg">
                              <div className="whitespace-normal px-1 py-0.5 text-sm font-medium">
                                {bank.name}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <p className="col-span-2 p-3 text-center text-sm text-muted-foreground">
                            {t("donations.common.states.noBankFound", "No banks found.")}
                          </p>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.common.accountNumber", "Account Number")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
                    value={formData.bankAccountNumber}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t("donations.common.placeholders.enterAccountNumber", "10 digit account number")}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      handleChange("bankAccountNumber", digits.slice(0, 10));
                    }}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.common.accountName", "Account Name")}</Label>
                  <Input
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 disabled:opacity-70 disabled:bg-black/5"
                    value={accountName}
                    placeholder={t("donations.common.placeholders.autoFilled", "Auto-filled upon verification")}
                    disabled
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2">
                {t("donations.business.sections.uploadDirectorId", "4. Director's Identity Document")}
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 items-end">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.common.idType", "Document Type")}</Label>
                  <Select
                    value={formData.directorIdType}
                    onValueChange={(value) => handleChange("directorIdType", value)}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus:ring-brand-green/30">
                      <SelectValue placeholder={t("donations.common.placeholders.selectIdType", "Select ID Type")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <SelectItem value="NIN" className="rounded-lg">{t("donations.common.idTypes.nin", "National ID (NIN)")}</SelectItem>
                      <SelectItem value="Passport" className="rounded-lg">{t("donations.common.idTypes.passport", "International Passport")}</SelectItem>
                      <SelectItem value="Driver's License" className="rounded-lg">{t("donations.common.idTypes.driversLicense", "Driver's License")}</SelectItem>
                      <SelectItem value="Voter's Card" className="rounded-lg">{t("donations.common.idTypes.votersCard", "Voter's Card")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("donations.individual.sections.uploadIdDocument", "Upload Document")}</Label>
                  <div className="relative">
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => handleChange("directorIdFile", e.target.files?.[0] || null)}
                    />
                    <div className="h-11 w-full rounded-xl border border-border/60 bg-black/[0.02] hover:bg-black/[0.04] transition-colors flex items-center px-4">
                      <UploadCloud className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground truncate">
                        {formData.directorIdFile ? formData.directorIdFile.name : t("common.actions.uploadFile", "Choose file...")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button variant="ghost" className="hidden sm:flex rounded-xl" onClick={() => setStep("card")}>
                {t("common.actions.cancel", "Cancel")}
              </Button>
              <Button 
                className="w-full sm:w-auto h-12 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold transition-all"
                onClick={handleSubmit}
                disabled={!accountName || !formData.directorIdFile}
              >
                {t("donations.actions.completeVerification", "Submit Verification")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
