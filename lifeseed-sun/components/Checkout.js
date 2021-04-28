import { loadStripe } from '@stripe/stripe-js';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button } from '@material-ui/core';
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { useState } from 'react';
import nProgress from 'nprogress';
import { gql, useMutation } from '@apollo/client';
import { useRouter } from 'next/dist/client/router';

import { useApp } from '../lib/appState';
import { CURRENT_USER_QUERY } from './User';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  checkoutForm: {
    boxShadow: '0 1px 2px 2px rgba(0, 0, 0, 0.04)',
    bpackage: '1px solid rgba(0, 0, 0, 0.06)',
    bpackageRadius: '5px',
    padding: '1rem',
    display: 'grid',
    gridGap: '1rem',
  },
}));

const CREATE_PACKAGE_MUTATION = gql`
  mutation CREATE_PACKAGE_MUTATION($token: String!) {
    checkout(token: $token) {
      id
      charge
      total
      items {
        id
        name
      }
    }
  }
`;

const stripeLib = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY);

function CheckoutForm() {
  const classes = useStyles();
  const [error, setError] = useState();
  const [loading, setLoading] = useState();
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { closeBasket } = useApp();

  const [checkout, { error: graphQLError }] = useMutation(
    CREATE_PACKAGE_MUTATION,
    {
      refetchQueries: [{ query: CURRENT_USER_QUERY }],
    }
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    nProgress.start();
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardElement),
    });
    console.log(paymentMethod);
    if (error) {
      setError(error);
      nProgress.done();
      return;
    }

    const myPackage = await checkout({
      variables: {
        token: paymentMethod.id,
      },
    });

    console.log(`Finished the myP`);
    console.log(myPackage);

    router.push({
      pathname: `/package/[id]`,
      query: { id: myPackage.data.checkout.id },
    });

    closeBasket();

    setLoading(false);
    nProgress.done();
  }

  return (
    <Box className={classes.checkoutForm} onSubmit={handleSubmit}>
      {error && <p style={{ fontSize: 12 }}>{error.message}</p>}
      {graphQLError && <p style={{ fontSize: 12 }}>{graphQLError.message}</p>}
      <CardElement />
      <Button onClick={handleSubmit}>Check out Now</Button>
    </Box>
  );
}

function Checkout() {
  return (
    <Elements stripe={stripeLib}>
      <CheckoutForm />
    </Elements>
  );
}

export default Checkout;
