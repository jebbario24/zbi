import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HelpCircle, Mail, MessageSquare, FileText, Phone } from "lucide-react";

export default function DriverHelp() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HelpCircle className="h-8 w-8" />
          Help & Support
        </h1>
        <p className="text-muted-foreground">
          Find answers and get help when you need it
        </p>
      </div>

      {/* Contact Support */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-email-support">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Support
            </CardTitle>
            <CardDescription>
              Get help via email within 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:driver-support@eatout.com">
                Contact Support
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-phone-support">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Support
            </CardTitle>
            <CardDescription>
              Call us for immediate assistance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <a href="tel:1-800-EATOUT">
                1-800-EATOUT
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>
            Quick answers to common questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I get paid?</AccordionTrigger>
              <AccordionContent>
                You earn 80% of the delivery fee for each completed order. Once your earnings reach $10, payouts are automatically processed to your connected Stripe account. Funds typically arrive within 2-3 business days.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>How do I accept orders?</AccordionTrigger>
              <AccordionContent>
                First, make sure your status is set to "Online" using the toggle at the top of your dashboard. Available orders will appear on your dashboard and in the "Available Orders" page. Click "Accept Order" to start a delivery.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>What if I need to cancel a delivery?</AccordionTrigger>
              <AccordionContent>
                If you need to cancel a delivery after accepting it, please contact support immediately at driver-support@eatout.com or call 1-800-EATOUT. Frequent cancellations may affect your account standing.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>How do I update my profile information?</AccordionTrigger>
              <AccordionContent>
                Go to Settings from the sidebar menu. You can update your personal information, upload required documents, and manage your payout account. Make sure all information is accurate to avoid delays in approval or payments.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>What documents do I need to upload?</AccordionTrigger>
              <AccordionContent>
                You need to upload a valid driver's license, proof of insurance, and vehicle registration. All documents must be current and clearly visible. You can upload these in the Settings page under the Documents section.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>How long does approval take?</AccordionTrigger>
              <AccordionContent>
                Once you complete your profile and upload all required documents, our team typically reviews applications within 24-48 hours. You'll receive an email notification once your application is approved.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>Can I work on my own schedule?</AccordionTrigger>
              <AccordionContent>
                Yes! As a driver, you have complete flexibility to set your own schedule. Simply toggle your status to "Online" when you're ready to accept deliveries, and "Offline" when you're done for the day.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>What should I do if there's an issue with an order?</AccordionTrigger>
              <AccordionContent>
                If you encounter any issues during a delivery (wrong address, customer unavailable, order problems), contact support immediately at 1-800-EATOUT. Keep the order with you and await instructions from our support team.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Driver Resources
          </CardTitle>
          <CardDescription>
            Helpful guides and information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" className="w-full justify-start" asChild>
            <a href="#" target="_blank">
              Driver Handbook
            </a>
          </Button>
          <Button variant="ghost" className="w-full justify-start" asChild>
            <a href="#" target="_blank">
              Safety Guidelines
            </a>
          </Button>
          <Button variant="ghost" className="w-full justify-start" asChild>
            <a href="#" target="_blank">
              Best Practices for Deliveries
            </a>
          </Button>
          <Button variant="ghost" className="w-full justify-start" asChild>
            <a href="#" target="_blank">
              Terms of Service
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
