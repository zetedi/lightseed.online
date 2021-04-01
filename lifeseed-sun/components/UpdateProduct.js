import { useMutation, useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import { Button, TextField } from '@material-ui/core';
import useForm from '../lib/useForm';
import DisplayError from './ErrorMessage';

const SINGLE_PRODUCT_QUERY = gql`
  query SINGLE_PRODUCT_QUERY($id: ID!) {
    Product(where: { id: $id }) {
      name
      price
      description
      id
    }
  }
`;

const UPDATE_PRODUCT_MUTATION = gql`
  mutation UPDATE_PRODUCT_MUTATION(
    $id: ID!
    $name: String
    $description: String
    $price: Int
  ) {
    updateProduct(
      id: $id
      data: { name: $name, description: $description, price: $price }
    ) {
      id
      price
      name
      description
    }
  }
`;

export default function UpdateProduct({ id }) {
  const { data, error, loading } = useQuery(SINGLE_PRODUCT_QUERY, {
    variables: {
      id,
    },
  });

  const [
    updateProduct,
    { data: updateData, error: updateError, loading: updateLoading },
  ] = useMutation(UPDATE_PRODUCT_MUTATION);

  const { inputs, handleChange, clearForm, resetForm } = useForm(data?.Product);
  console.log(inputs);
  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await updateProduct({
            variables: {
              id,
              name: inputs.name,
              description: inputs.description,
              price: inputs.price,
            },
          }).catch(console.error);
          console.log(res);
          //   Router.push({
          //     pathname: `/product/${res.data.createProduct.id}`,
          //   });
        }}
      >
        <DisplayError error={error || updateError} />
        <fieldset disabled={updateLoading} aria-busy={updateLoading}>
          <TextField
            type="text"
            id="name"
            name="name"
            placeholde="Name"
            value={inputs.name}
            onChange={handleChange}
          />
          <TextField
            type="number"
            id="price"
            name="price"
            placeholde="price"
            value={inputs.price}
            onChange={handleChange}
          />
          <TextField
            type="textarea"
            id="description"
            name="description"
            placeholde="Description"
            value={inputs.description}
            onChange={handleChange}
          />
          <Button type="submit">Update product</Button>
        </fieldset>
      </form>
    </div>
  );
}
