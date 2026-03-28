import { useEffect, useState } from "react";
import { User } from "lucide-react";

import { fetchKyc, getBankList, submitKyc, verifyBank } from "../api/donationApi";
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

export default function IndividualDonation({ onComplete }) {
  const { toast } = useToast();
  const [step, setStep] = useState("card");
  const [banks, setBanks] = useState([]);
  const [accountName, setAccountName] = useState("");
  const [bankCode, setBankCode] = useState(null);
  const [, setKycStatus] = useState({});
  const [bankSearch, setBankSearch] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    address: "",
    bvn: "",
    account_number: "",
    id_type: "",
    id_document: null,
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
    if (formData.account_number.length === 10 && bankCode !== null) {
      verifyBank(formData.account_number, bankCode.code)
        .then((res) => {
          if (res.success) setAccountName(res.data.account_name);
          else setAccountName("");
        })
        .catch(() => setAccountName(""));
    }
  }, [formData.account_number, bankCode]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const filteredBanks = banks.filter((bank) =>
    bank?.name?.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => fd.append(key, value));
      fd.append("bank_code", bankCode?.code);
      fd.append("bank_name", bankCode?.name);
      fd.append("bank_account_name", accountName);
      fd.append("bank_account_number", formData.account_number);
      fd.append("type", "individual");

      const res = await submitKyc(fd);
      if (res.success) onComplete();
      else {
        toast({
          description: res.message || "KYC failed",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        description: "Error submitting KYC",
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
              <User className="h-7 w-7 text-green-600 dark:text-green-300" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
              Individual Account
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
              For personal fundraising and individual donors
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-muted-foreground">
              <li>• BVN Verification</li>
              <li>• Bank Account Details</li>
              <li>• Government ID Upload</li>
            </ul>
            <Button className="mt-6" onClick={() => setStep("form")}>
              Start Verification
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "form" && (
        <Card className="w-full max-w-3xl rounded-2xl border border-gray-200 shadow-md dark:border-border">
          <CardHeader className="flex items-center justify-between border-b pb-4 dark:border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
                <User className="text-green-600 dark:text-green-300" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Individual KYC Verification
                </CardTitle>
                <p className="text-sm text-gray-500 dark:text-muted-foreground">
                  Complete your verification details
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setStep("card")}>
              Back
            </Button>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            <section>
              <h3 className="mb-4 text-md font-semibold">Personal Information</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>First Name</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
                <div>
                  <Label>BVN</Label>
                  <Input
                    value={formData.bvn}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Enter 10-digit BVN"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      handleChange("bvn", digits.slice(0, 10));
                    }}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-md font-semibold">Bank Details</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Bank</Label>
                  <Select
                    value={bankCode?.name}
                    onValueChange={(value) => {
                      setBankCode(value);
                      setBankSearch("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="sticky top-0 z-10 bg-white p-2 dark:bg-popover">
                        <Input
                          placeholder="Search bank..."
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                        />
                      </div>

                      <div className="grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto p-2 md:grid-cols-2">
                        {filteredBanks.length > 0 ? (
                          filteredBanks.map((bank) => (
                            <SelectItem key={bank.code} value={bank}>
                              <div className="!static whitespace-normal px-2 py-1 text-sm">
                                {bank.name}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <p className="col-span-2 px-2 py-1 text-sm text-gray-500 dark:text-muted-foreground">
                            No bank found
                          </p>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Account Number</Label>
                  <Input
                    value={formData.account_number}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Enter 10-digit account number"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      handleChange("account_number", digits.slice(0, 10));
                    }}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Account Name</Label>
                  <Input
                    value={accountName}
                    placeholder="Will Be Auto-filled"
                    disabled
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-md font-semibold">Government ID</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>ID Type</Label>
                  <Select
                    value={formData.id_type}
                    onValueChange={(value) => handleChange("id_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID type" />
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
              <h3 className="mb-4 text-md font-semibold">Upload ID Document</h3>
              <input
                type="file"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-muted file:px-4 file:py-2 file:text-foreground hover:file:bg-accent"
                onChange={(e) =>
                  handleChange("id_document", e.target.files?.[0] || null)
                }
              />
            </section>

            <div className="flex justify-center">
              <Button onClick={handleSubmit}>Complete Verification</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
