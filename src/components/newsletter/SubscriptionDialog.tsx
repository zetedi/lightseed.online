import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase"; // Updated to firebase.ts
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/components/ui/use-toast";

export function SubscriptionDialog() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const inputHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const submitHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    try {
      await addDoc(collection(db, "emails"), {
        email,
        timestamp: serverTimestamp(),
      });
      setEmail("");
      toast({
        title: "Thank you! The email you subscribed with is:",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-green-950 p-4">
            <code className="text-white">{JSON.stringify(email, null, 2)}</code>
          </pre>
        ),
      });
    } catch (e) {
      console.error("Error adding document: ", e);
      toast({ title: "Subscription failed", variant: "destructive" });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="redbutton dark:text-white light:text-black text-base">
          One email every seven weeks
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>One email every seven weeks.</DialogTitle>
          <DialogDescription>You might get the first one earlier</DialogDescription>
        </DialogHeader>
        <Input
          id="name"
          type="email"
          placeholder="Email address"
          onChange={inputHandler}
          value={email}
          required
        />
        <DialogFooter className="sm:justify-end">
          <Button
            className="redbutton dark:text-white light:text-black"
            onClick={submitHandler}
          >
            Subscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}