import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
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
          description: res.message || t("donations.kycFailed"),
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        description: t("donations.businessKycError"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-14 flex flex-1 items-center justify-center py-10">
      {step === "card" && (
        <Card className="w-[320px] rounded-2xl border border-gray-200 shadow-md dark:border-border md:w-[380px] lg:w-[320px]">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
              <Building2 className="h-7 w-7 text-green-600 dark:text-green-300" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
              {t("donations.businessAccount")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
              {t("donations.businessDescription")}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-muted-foreground">
              <li>• {t("donations.sections.companyInformation")}</li>
              <li>• {t("donations.sections.directorInformation")}</li>
              <li>• {t("donations.steps.bank.title")}</li>
              <li>• {t("donations.sections.uploadDirectorId")}</li>
            </ul>
            <Button className="mt-6" onClick={() => setStep("form")}>
              {t("donations.startVerification")}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "form" && (
        <Card className="w-full max-w-3xl rounded-2xl border border-gray-200 shadow-md dark:border-border">
          <CardHeader className="flex items-center justify-between border-b pb-4 dark:border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
                <Building2 className="text-green-600 dark:text-green-300" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {t("donations.businessVerificationTitle")}
                </CardTitle>
                <p className="text-sm text-gray-500 dark:text-muted-foreground">
                  {t("donations.completeBusinessVerificationDetails")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setStep("card")}>
              {t("actions.back")}
            </Button>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            <section>
              <h3 className="mb-4 text-md font-semibold">
                {t("donations.sections.companyInformation")}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>{t("donations.companyName")}</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("donations.companyEmail")}</Label>
                  <Input
                    value={formData.companyEmail}
                    onChange={(e) =>
                      handleChange("companyEmail", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.companyPhone")}</Label>
                  <Input
                    value={formData.companyPhone}
                    onChange={(e) =>
                      handleChange("companyPhone", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>{t("donations.companyAddress")}</Label>
                  <Input
                    value={formData.companyAddress}
                    onChange={(e) =>
                      handleChange("companyAddress", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.taxId")}</Label>
                  <Input
                    value={formData.taxId}
                    onChange={(e) => handleChange("taxId", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-md font-semibold">
                {t("donations.sections.directorInformation")}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>{t("donations.firstName")}</Label>
                  <Input
                    value={formData.directorFirstName}
                    onChange={(e) =>
                      handleChange("directorFirstName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.lastName")}</Label>
                  <Input
                    value={formData.directorLastName}
                    onChange={(e) =>
                      handleChange("directorLastName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.email")}</Label>
                  <Input
                    value={formData.directorEmail}
                    onChange={(e) =>
                      handleChange("directorEmail", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.phone")}</Label>
                  <Input
                    value={formData.directorPhone}
                    onChange={(e) =>
                      handleChange("directorPhone", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.bvn")}</Label>
                  <Input
                    value={formData.directorBvn}
                    onChange={(e) =>
                      handleChange("directorBvn", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("donations.idType")}</Label>
                  <Select
                    value={formData.directorIdType}
                    onValueChange={(value) =>
                      handleChange("directorIdType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("donations.selectIdType")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIN">NIN</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                      <SelectItem value="Driver's License">
                        Driver&apos;s License
                      </SelectItem>
                      <SelectItem value="Voter's Card">
                        Voter&apos;s Card
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-md font-semibold">
                {t("donations.sections.bankDetails")}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>{t("donations.bank")}</Label>
                  <Select
                    value={bankCode?.name}
                    onValueChange={(value) => setBankCode(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("donations.selectBank")} />
                    </SelectTrigger>
                    <SelectContent className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto p-2 lg:grid-cols-4">
                      <div className="grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto p-2 md:grid-cols-2">
                        {banks.map((bank) => (
                          <SelectItem key={bank.code} value={bank}>
                            <div className="!static whitespace-normal px-2 py-1 text-sm">
                              {bank.name}
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("donations.accountNumber")}</Label>
                  <Input
                    value={formData.bankAccountNumber}
                    onChange={(e) =>
                      handleChange("bankAccountNumber", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>{t("donations.accountName")}</Label>
                  <Input
                    value={accountName}
                    placeholder={t("donations.willBeAutofilled")}
                    disabled
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-md font-semibold">
                {t("donations.sections.uploadDirectorId")}
              </h3>
              <input
                type="file"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-muted file:px-4 file:py-2 file:text-foreground hover:file:bg-accent"
                onChange={(e) =>
                  handleChange("directorIdFile", e.target.files?.[0] || null)
                }
              />
            </section>

            <div className="flex justify-center">
              <Button onClick={handleSubmit}>
                {t("donations.completeVerification")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
