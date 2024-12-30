import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

const PricingCard = ({ variant }) => {
  return (
    <Card>
      <h3>Basic</h3>
      <p>For individuals</p>

      <h4>Free Forever</h4>
      <Button>Free</Button>
      <ul>
        <li>A test Feature</li>
        <li>A test Feature</li>
        <li>A test Feature</li>
      </ul>
      <Button>View More</Button>
    </Card>
  );
};

export default PricingCard;
