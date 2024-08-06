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
import { db } from "../../../firebase";
import { collection, addDoc } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { useToast } from "@/components/ui/use-toast";

export function SubscriptionDialog() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const inputHandler = (e) => {
    console.log(email);
    setEmail(e.target.value);
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "emails"), {
        email: email,
        timestamp: serverTimestamp()
      });
      console.log("Document written with ID: ", docRef.id);
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
            <DialogDescription>
              You might get the first one earlier
            </DialogDescription>
          </DialogHeader>

          <Input
            id="name"
            type="email"
            placeholder="Email address"
            onChange={inputHandler}
            value={email}
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
